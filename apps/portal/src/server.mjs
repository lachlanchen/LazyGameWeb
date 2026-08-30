import { randomBytes } from 'node:crypto'
import { constants as fsConstants } from 'node:fs'
import { open, realpath, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { isIP } from 'node:net'
import { extname, join, relative, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'
import { PRODUCTS } from './config.mjs'
import { loginPage, portalPage } from './html.mjs'
import { dispatchEnvelope, resolveBrowserApi, RouteError } from './routes.mjs'
import {
  BoundedSemaphore,
  FixedWindowRateLimiter,
  parseCookies,
  randomToken,
  safeEqualString,
  securityHeaders,
  verifyPassword,
} from './security.mjs'
import { clearSessionCookies, LOGIN_COOKIE } from './session-store.mjs'

const CONTENT_TYPES = new Map([
  ['.avif', 'image/avif'],
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.mp3', 'audio/mpeg'],
  ['.ogg', 'audio/ogg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.wav', 'audio/wav'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
])
const COMPRESSIBLE = /^(?:text\/|application\/(?:javascript|json|manifest\+json|wasm)|image\/svg\+xml)/

class HttpError extends Error {
  constructor(status, code, message, headers = {}) {
    super(message)
    this.status = status
    this.code = code
    this.headers = headers
  }
}

function applyHeaders(response, headers) {
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value)
}

function sendJson(request, response, status, value, extraHeaders = {}) {
  const body = Buffer.from(JSON.stringify(value))
  response.statusCode = status
  applyHeaders(response, securityHeaders({ nonce: 'unused' }))
  applyHeaders(response, {
    'Cache-Control': 'no-store',
    'Content-Length': String(body.length),
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  })
  response.end(request.method === 'HEAD' ? undefined : body)
}

function sendHtml(request, response, status, html, nonce, extraHeaders = {}) {
  const body = Buffer.from(html)
  response.statusCode = status
  applyHeaders(response, securityHeaders({ nonce }))
  applyHeaders(response, {
    'Cache-Control': 'no-store',
    'Content-Length': String(body.length),
    'Content-Type': 'text/html; charset=utf-8',
    ...extraHeaders,
  })
  response.end(request.method === 'HEAD' ? undefined : body)
}

function redirect(response, location, status = 303, cookies) {
  response.statusCode = status
  applyHeaders(response, securityHeaders({ nonce: 'unused' }))
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Location', location)
  if (cookies) response.setHeader('Set-Cookie', cookies)
  response.end()
}

function validateRawTarget(rawTarget) {
  if (typeof rawTarget !== 'string' || rawTarget.length < 1 || rawTarget.length > 8192 || !rawTarget.startsWith('/') || rawTarget.startsWith('//')) {
    throw new HttpError(400, 'invalid_request_target', 'Request target is invalid')
  }
  const rawPath = rawTarget.split('?', 1)[0]
  if (rawPath.includes('\\') || /%(?:00|2f|5c)/i.test(rawPath)) throw new HttpError(400, 'invalid_path', 'Encoded separators are not accepted')
  let decoded
  try {
    decoded = decodeURIComponent(rawPath)
  } catch {
    throw new HttpError(400, 'invalid_path_encoding', 'Path encoding is invalid')
  }
  if (decoded.includes('\0') || decoded.includes('\\') || decoded.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new HttpError(400, 'invalid_path', 'Path traversal is not accepted')
  }
}

function parseRequestUrl(request, config) {
  validateRawTarget(request.url)
  return new URL(request.url, config.publicOrigin)
}

function loopbackHost(host, port) {
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`
}

function requireHost(request, config, health = false) {
  const host = request.headers.host
  if (host === config.publicHost) return
  if (health && typeof host === 'string' && loopbackHost(host, config.listen.port)) return
  throw new HttpError(421, 'unexpected_authority', 'Request authority is not accepted')
}

function requireSameOrigin(request, config) {
  if (request.headers.origin !== config.publicOrigin) throw new HttpError(403, 'origin_rejected', 'Request origin is not accepted')
  const fetchSite = request.headers['sec-fetch-site']
  if (fetchSite !== undefined && fetchSite !== 'same-origin') throw new HttpError(403, 'fetch_site_rejected', 'Cross-site requests are not accepted')
}

function clientAddress(request) {
  const supplied = request.headers['x-lazying-client-address']
  if (typeof supplied === 'string' && supplied.length <= 64 && isIP(supplied)) return supplied
  const remote = request.socket.remoteAddress ?? 'unknown'
  return remote.startsWith('::ffff:') ? remote.slice(7) : remote
}

async function readRequestBody(request, maximum) {
  const declared = request.headers['content-length']
  if (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > maximum)) {
    throw new HttpError(413, 'request_too_large', 'Request body exceeds the accepted bound')
  }
  const chunks = []
  let length = 0
  for await (const chunk of request) {
    length += chunk.length
    if (length > maximum) throw new HttpError(413, 'request_too_large', 'Request body exceeds the accepted bound')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, length)
}

function requireContentType(request, expected) {
  const supplied = request.headers['content-type']
  if (typeof supplied !== 'string' || supplied.split(';', 1)[0].trim().toLowerCase() !== expected) {
    throw new HttpError(415, 'unsupported_media_type', `Content-Type must be ${expected}`)
  }
}

async function readForm(request, maximum = 8192) {
  requireContentType(request, 'application/x-www-form-urlencoded')
  const body = await readRequestBody(request, maximum)
  const parameters = new URLSearchParams(body.toString('utf8'))
  const result = {}
  for (const [key, value] of parameters) {
    if (!['csrf', 'username', 'password', 'remember', 'next'].includes(key) || Object.hasOwn(result, key)) {
      throw new HttpError(400, 'invalid_form', 'Form fields are invalid')
    }
    result[key] = value
  }
  return result
}

async function readJson(request, maximum) {
  requireContentType(request, 'application/json')
  const body = await readRequestBody(request, maximum)
  if (body.length === 0) throw new HttpError(400, 'empty_json', 'JSON body is required')
  try {
    const parsed = JSON.parse(body.toString('utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new HttpError(400, 'invalid_json_object', 'JSON body must be an object')
    return parsed
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'invalid_json', 'JSON body is invalid')
  }
}

function safeNext(value) {
  if (typeof value !== 'string' || value.length > 1024 || !value.startsWith('/') || value.startsWith('//')) return '/'
  let parsed
  try {
    parsed = new URL(value, 'https://game.invalid')
  } catch {
    return '/'
  }
  if (parsed.origin !== 'https://game.invalid') return '/'
  if (parsed.pathname === '/') return `${parsed.pathname}${parsed.search}`
  if (!PRODUCTS.some((product) => parsed.pathname === `/${product}` || parsed.pathname.startsWith(`/${product}/`))) return '/'
  return `${parsed.pathname}${parsed.search}`
}

function requestedNext(url) {
  const values = url.searchParams.getAll('next')
  return values.length === 1 ? safeNext(values[0]) : '/'
}

function loginCookie(request) {
  try {
    return parseCookies(request.headers.cookie).get(LOGIN_COOKIE)
  } catch {
    return undefined
  }
}

function loginResponse(request, response, registry, { status = 200, next = '/', error = false } = {}) {
  const challenge = registry.newLoginChallenge()
  const nonce = randomToken(18)
  sendHtml(request, response, status, loginPage({ nonce, csrf: challenge.value, next, error }), nonce, {
    'Set-Cookie': challenge.cookie,
  })
}

async function resolveStaticFile(root, urlPath) {
  let relativePath = urlPath
  if (!relativePath || relativePath.endsWith('/')) relativePath += 'index.html'
  if (relativePath.startsWith('/') || relativePath.split('/').some((part) => !part || part === '.' || part === '..' || part.startsWith('.'))) {
    throw new HttpError(404, 'asset_not_found', 'Asset not found')
  }
  const candidate = join(root, relativePath)
  let resolved
  try {
    resolved = await realpath(candidate)
  } catch (error) {
    if (error && typeof error === 'object' && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) return null
    throw error
  }
  if (relative(root, resolved).startsWith(`..${sep}`) || resolved === root) throw new HttpError(404, 'asset_not_found', 'Asset not found')
  const metadata = await stat(resolved)
  if (!metadata.isFile()) return null
  return { path: resolved, metadata }
}

export function csrfBootstrap(csrfToken) {
  const token = JSON.stringify(csrfToken)
  return `(()=>{const csrf=${token};const nativeFetch=window.fetch.bind(window);const stateChanging=new Set(['POST','PUT','PATCH','DELETE']);window.fetch=(input,init={})=>{const request=typeof Request!=='undefined'&&input instanceof Request?input:null;const url=new URL(request?request.url:String(input),window.location.href);const method=String(init.method??request?.method??'GET').toUpperCase();if(url.origin===window.location.origin&&url.pathname.startsWith('/api/')&&stateChanging.has(method)){const headers=new Headers(init.headers??request?.headers);headers.set('X-Game-CSRF',csrf);return nativeFetch(input,{...init,headers})}return nativeFetch(input,init)}})();\n`
}

async function serveSpaIndex(request, response, config, file) {
  if (file.metadata.size > 2 * 1024 * 1024) throw new HttpError(500, 'invalid_release_index', 'Application index exceeds its reviewed bound')
  const handle = await open(file.path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
  let source
  try {
    source = await handle.readFile({ encoding: 'utf8' })
  } finally {
    await handle.close()
  }
  if (source.includes('/portal/bootstrap.js')) throw new HttpError(500, 'invalid_release_index', 'Application index contains a reserved bootstrap path')
  const bootstrap = '<script src="/portal/bootstrap.js"></script>'
  const scriptIndex = source.search(/<script\b/i)
  const headEnd = source.search(/<\/head\s*>/i)
  const insertion = scriptIndex >= 0 ? scriptIndex : headEnd
  if (insertion < 0) throw new HttpError(500, 'invalid_release_index', 'Application index has no safe bootstrap insertion point')
  const body = Buffer.from(`${source.slice(0, insertion)}${bootstrap}${source.slice(insertion)}`)
  response.statusCode = 200
  applyHeaders(response, securityHeaders({ spa: true }))
  applyHeaders(response, {
    'Cache-Control': 'no-store',
    'Content-Length': String(body.length),
    'Content-Type': 'text/html; charset=utf-8',
    'Vary': 'Cookie',
  })
  response.end(request.method === 'HEAD' ? undefined : body)
}

async function serveStatic(request, response, config, product, pathname) {
  const root = join(config.releaseDir, product)
  const prefix = `/${product}/`
  let relativePath = pathname.slice(prefix.length)
  if (!relativePath || relativePath.endsWith('/')) relativePath += 'index.html'
  let file = await resolveStaticFile(root, relativePath)
  if (!file && !extname(relativePath) && typeof request.headers.accept === 'string' && request.headers.accept.includes('text/html')) {
    relativePath = 'index.html'
    file = await resolveStaticFile(root, relativePath)
  }
  if (!file) throw new HttpError(404, 'asset_not_found', 'Asset not found')
  const extension = extname(file.path).toLowerCase()
  const contentType = CONTENT_TYPES.get(extension) ?? 'application/octet-stream'
  const entry = relativePath === 'index.html'
  if (entry) return await serveSpaIndex(request, response, config, file)
  const canGzip = !entry
    && file.metadata.size >= 1024
    && COMPRESSIBLE.test(contentType)
    && typeof request.headers['accept-encoding'] === 'string'
    && request.headers['accept-encoding'].split(',').some((item) => item.trim().split(';', 1)[0] === 'gzip')
  response.statusCode = 200
  applyHeaders(response, securityHeaders({ spa: true }))
  const updateChecked = relativePath === 'sw.js' || relativePath === 'manifest.webmanifest'
  applyHeaders(response, {
    'Accept-Ranges': 'none',
    'Cache-Control': updateChecked ? 'no-store' : 'private, max-age=31536000, immutable',
    'Content-Type': contentType,
    'ETag': `"${config.releaseId}-${file.metadata.size.toString(16)}-${Math.trunc(file.metadata.mtimeMs).toString(16)}"`,
    'Vary': 'Cookie, Accept-Encoding',
  })
  if (!canGzip) response.setHeader('Content-Length', String(file.metadata.size))
  else response.setHeader('Content-Encoding', 'gzip')
  if (request.method === 'HEAD') return response.end()
  const handle = await open(file.path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
  const stream = handle.createReadStream({ autoClose: true })
  if (canGzip) await pipeline(stream, createGzip({ level: 6 }), response)
  else await pipeline(stream, response)
}

async function readUpstreamResponse(response, maximum) {
  const declared = response.headers.get('content-length')
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maximum)) throw new Error('UPSTREAM_RESPONSE_TOO_LARGE')
  const chunks = []
  let length = 0
  if (!response.body) return Buffer.alloc(0)
  for await (const chunk of response.body) {
    const buffer = Buffer.from(chunk)
    length += buffer.length
    if (length > maximum) throw new Error('UPSTREAM_RESPONSE_TOO_LARGE')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks, length)
}

async function dispatchToPrivateGateway(request, response, runtime, route, body) {
  const controller = new AbortController()
  const disconnected = () => controller.abort(new Error('BROWSER_DISCONNECTED'))
  request.once('aborted', disconnected)
  response.once('close', disconnected)
  let release
  try {
    release = await runtime.upstreamSemaphore.acquire(controller.signal)
  } catch {
    request.removeListener('aborted', disconnected)
    response.removeListener('close', disconnected)
    if (request.aborted || response.destroyed || controller.signal.aborted) return
    throw new HttpError(503, 'game_compute_busy', 'Game computation queue is full', { 'Retry-After': '2' })
  }
  const timeout = setTimeout(() => controller.abort(new Error('UPSTREAM_TIMEOUT')), runtime.config.limits.upstreamTimeoutSeconds * 1000)
  timeout.unref()
  try {
    const envelope = dispatchEnvelope(route, body)
    let upstream
    try {
      upstream = await fetch(runtime.config.lazyEdge.dispatchUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${runtime.credentials.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(envelope),
        redirect: 'manual',
        signal: controller.signal,
      })
    } catch (error) {
      if (controller.signal.aborted && !request.aborted) throw new HttpError(504, 'game_compute_timeout', 'Game computation timed out')
      if (request.aborted) return
      throw new HttpError(503, 'game_compute_unavailable', 'Game computation is unavailable')
    }
    if (upstream.status < 200 || upstream.status > 599 || (upstream.status >= 300 && upstream.status < 400)) {
      await upstream.body?.cancel()
      throw new HttpError(502, 'invalid_upstream_status', 'Game gateway returned an invalid status')
    }
    const type = upstream.headers.get('content-type') ?? ''
    if (!/^application\/json(?:\s*;|$)/i.test(type)) {
      await upstream.body?.cancel()
      throw new HttpError(502, 'invalid_upstream_type', 'Game gateway returned an invalid media type')
    }
    let output
    try {
      output = await readUpstreamResponse(upstream, runtime.config.limits.upstreamResponseBytes)
    } catch {
      throw new HttpError(502, 'invalid_upstream_body', 'Game gateway response exceeded its bound')
    }
    response.statusCode = upstream.status
    applyHeaders(response, securityHeaders({ nonce: 'unused' }))
    applyHeaders(response, {
      'Cache-Control': 'no-store',
      'Content-Length': String(output.length),
      'Content-Type': 'application/json; charset=utf-8',
    })
    const retryAfter = upstream.headers.get('retry-after')
    if (retryAfter && /^\d{1,4}$/.test(retryAfter)) response.setHeader('Retry-After', retryAfter)
    response.end(request.method === 'HEAD' ? undefined : output)
  } finally {
    clearTimeout(timeout)
    request.removeListener('aborted', disconnected)
    response.removeListener('close', disconnected)
    release()
  }
}

function apiCsrf(request, session, registry, config) {
  requireSameOrigin(request, config)
  const supplied = request.headers['x-game-csrf']
  if (typeof supplied !== 'string' || !registry.verifyCsrf(session, supplied)) {
    throw new HttpError(403, 'csrf_rejected', 'CSRF token is missing or invalid')
  }
}

function rateLimitOrThrow(limiter, key, code) {
  const result = limiter.consume(key)
  if (!result.allowed) throw new HttpError(429, code, 'Rate limit exceeded', { 'Retry-After': String(result.retryAfterSeconds) })
}

export function createPortalServer({ config, credentials, sessions }) {
  const runtime = {
    config,
    credentials,
    sessions,
    loginClients: new FixedWindowRateLimiter({
      limit: config.limits.loginAttemptsPer15Minutes,
      windowMs: 15 * 60 * 1000,
    }),
    loginGlobal: new FixedWindowRateLimiter({
      limit: config.limits.globalLoginAttemptsPer15Minutes,
      windowMs: 15 * 60 * 1000,
      maxEntries: 1,
    }),
    loginSemaphore: new BoundedSemaphore(2, 0),
    api: new FixedWindowRateLimiter({
      limit: config.limits.apiRequestsPerMinute,
      windowMs: 60 * 1000,
    }),
    upstreamSemaphore: new BoundedSemaphore(config.limits.upstreamConcurrency),
  }

  return createServer({
    requestTimeout: (config.limits.upstreamTimeoutSeconds + 10) * 1000,
    headersTimeout: 15_000,
    maxHeaderSize: 16_384,
  }, async (request, response) => {
    try {
      const url = parseRequestUrl(request, config)
      if (url.pathname === '/healthz') {
        requireHost(request, config, true)
        if (request.method !== 'GET' && request.method !== 'HEAD') throw new HttpError(405, 'method_not_allowed', 'Health endpoint accepts GET or HEAD', { Allow: 'GET, HEAD' })
        if (url.search) throw new HttpError(400, 'query_not_allowed', 'Health endpoint does not accept query parameters')
        return sendJson(request, response, 200, { ok: true, service: 'lazying-game-web', release: config.releaseId })
      }
      requireHost(request, config)
      if (url.pathname === '/login') {
        if (request.method !== 'GET' && request.method !== 'HEAD') throw new HttpError(405, 'method_not_allowed', 'Login page accepts GET or HEAD', { Allow: 'GET, HEAD' })
        const existing = sessions.authenticate(request.headers.cookie)
        if (existing) return redirect(response, '/')
        return loginResponse(request, response, sessions, { next: requestedNext(url) })
      }
      if (url.pathname === '/auth/login') {
        if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Login requires POST', { Allow: 'POST' })
        requireSameOrigin(request, config)
        rateLimitOrThrow(runtime.loginClients, clientAddress(request), 'login_rate_limited')
        rateLimitOrThrow(runtime.loginGlobal, 'global', 'login_rate_limited')
        const form = await readForm(request)
        const challengeValid = sessions.verifyLoginChallenge(loginCookie(request), form.csrf)
        const usernameValid = typeof form.username === 'string' && safeEqualString(form.username, config.username)
        let releaseLogin
        try {
          releaseLogin = await runtime.loginSemaphore.acquire()
        } catch {
          throw new HttpError(503, 'login_busy', 'Sign-in verification is busy; retry shortly', { 'Retry-After': '2' })
        }
        let passwordValid = false
        try {
          passwordValid = typeof form.password === 'string' && await verifyPassword(form.password, credentials.password.verifier)
        } catch {
          passwordValid = false
        } finally {
          releaseLogin()
        }
        if (!challengeValid) throw new HttpError(403, 'login_csrf_rejected', 'Login challenge is invalid')
        if (!usernameValid || !passwordValid) return loginResponse(request, response, sessions, { status: 401, next: safeNext(form.next), error: true })
        let created
        try {
          created = await sessions.create({ remember: form.remember === 'yes' })
        } catch {
          throw new HttpError(503, 'session_store_unavailable', 'Unable to create a session')
        }
        return redirect(response, safeNext(form.next), 303, [created.cookie, clearSessionCookies()[1]])
      }
      const session = sessions.authenticate(request.headers.cookie)
      if (!session) {
        if (url.pathname.startsWith('/api/')) throw new HttpError(401, 'authentication_required', 'Authentication is required')
        const next = safeNext(`${url.pathname}${url.search}`)
        return redirect(response, `/login?next=${encodeURIComponent(next)}`, 303, clearSessionCookies())
      }
      if (url.pathname === '/auth/logout') {
        if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Logout requires POST', { Allow: 'POST' })
        requireSameOrigin(request, config)
        const form = await readForm(request)
        if (!sessions.verifyCsrf(session, form.csrf)) throw new HttpError(403, 'csrf_rejected', 'CSRF token is missing or invalid')
        await sessions.revoke(session)
        return redirect(response, '/login', 303, clearSessionCookies())
      }
      if (url.pathname === '/api/session') {
        if (request.method !== 'GET') throw new HttpError(405, 'method_not_allowed', 'Session endpoint requires GET', { Allow: 'GET' })
        if (url.search) throw new HttpError(400, 'query_not_allowed', 'Session endpoint does not accept query parameters')
        return sendJson(request, response, 200, {
          authenticated: true,
          username: session.username,
          expiresAt: new Date(session.expiresAt).toISOString(),
          remembered: session.remembered,
          csrfToken: session.csrfToken,
        })
      }
      if (url.pathname === '/portal/bootstrap.js') {
        if (request.method !== 'GET' && request.method !== 'HEAD') throw new HttpError(405, 'method_not_allowed', 'Bootstrap endpoint accepts GET or HEAD', { Allow: 'GET, HEAD' })
        if (url.search) throw new HttpError(400, 'query_not_allowed', 'Bootstrap endpoint does not accept query parameters')
        const body = Buffer.from(csrfBootstrap(session.csrfToken))
        response.statusCode = 200
        applyHeaders(response, securityHeaders({ spa: true }))
        applyHeaders(response, {
          'Cache-Control': 'no-store',
          'Content-Length': String(body.length),
          'Content-Type': 'text/javascript; charset=utf-8',
          'Vary': 'Cookie',
        })
        return response.end(request.method === 'HEAD' ? undefined : body)
      }
      if (url.pathname === '/') {
        if (request.method !== 'GET' && request.method !== 'HEAD') throw new HttpError(405, 'method_not_allowed', 'Portal accepts GET or HEAD', { Allow: 'GET, HEAD' })
        if (url.search) throw new HttpError(400, 'query_not_allowed', 'Portal root does not accept query parameters')
        const nonce = randomToken(18)
        return sendHtml(request, response, 200, portalPage({ nonce, username: session.username, csrf: session.csrfToken }), nonce)
      }
      for (const product of PRODUCTS) {
        if (url.pathname === `/${product}`) return redirect(response, `/${product}/${url.search}`, 308)
        if (url.pathname.startsWith(`/${product}/`)) {
          if (request.method !== 'GET' && request.method !== 'HEAD') throw new HttpError(405, 'method_not_allowed', 'Static applications accept GET or HEAD', { Allow: 'GET, HEAD' })
          return await serveStatic(request, response, config, product, url.pathname)
        }
      }
      const apiRoute = resolveBrowserApi(request.method ?? 'GET', url)
      if (apiRoute) {
        rateLimitOrThrow(runtime.api, session.sessionHash, 'api_rate_limited')
        let body
        if (apiRoute.method !== 'GET') {
          apiCsrf(request, session, sessions, config)
          body = await readJson(request, config.limits.requestBodyBytes)
        } else if (request.headers['content-length'] !== undefined || request.headers['transfer-encoding'] !== undefined) {
          throw new HttpError(400, 'get_body_rejected', 'GET requests must not contain a body')
        }
        return await dispatchToPrivateGateway(request, response, runtime, apiRoute, body)
      }
      throw new HttpError(404, 'not_found', 'Not found')
    } catch (error) {
      if (response.headersSent || response.writableEnded || request.aborted) return response.destroy()
      if (error instanceof RouteError || error instanceof HttpError) {
        return sendJson(request, response, error.status, { code: error.code, detail: error.message }, error.headers)
      }
      return sendJson(request, response, 500, { code: 'internal_error', detail: 'The request could not be completed' })
    }
  })
}

export function randomSessionSecret() {
  return randomBytes(48).toString('base64url')
}
