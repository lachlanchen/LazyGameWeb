import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createServer as createHttpServer, request as httpRequestRaw } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import { normalizeConfig, loadCredentials, PRODUCTS } from '../src/config.mjs'
import {
  BoundedSemaphore,
  FixedWindowRateLimiter,
  makeScryptVerifier,
  passwordRecord,
  trustedSystemdCredentialDirectoryMetadata,
  trustedSystemdCredentialFileMetadata,
} from '../src/security.mjs'
import { createPortalServer } from '../src/server.mjs'
import { SessionRegistry } from '../src/session-store.mjs'

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve(server.address().port)
    })
  })
}

function close(server) {
  return new Promise((resolve) => server.close(resolve))
}

function request(port, path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : Buffer.from(body)
    const request = httpRequestRaw({
      host: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        Host: 'game.example.test',
        ...(payload ? { 'Content-Length': String(payload.length) } : {}),
        ...headers,
      },
    }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks),
        text: Buffer.concat(chunks).toString('utf8'),
      }))
    })
    request.on('error', reject)
    request.end(payload)
  })
}

function cookieFrom(headers, name) {
  const values = Array.isArray(headers['set-cookie']) ? headers['set-cookie'] : [headers['set-cookie']]
  const matched = values.find((value) => value?.startsWith(`${name}=`))
  assert.ok(matched, `missing ${name} cookie`)
  return matched.split(';', 1)[0]
}

function hidden(html, name) {
  const pattern = new RegExp(`name="${name}" value="([^"]*)"`)
  const matched = pattern.exec(html)
  assert.ok(matched, `missing ${name} field`)
  return matched[1]
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    const stdout = []
    const stderr = []
    child.stdout.on('data', (chunk) => stdout.push(chunk))
    child.stderr.on('data', (chunk) => stderr.push(chunk))
    child.once('error', reject)
    child.once('exit', (code) => resolve({ code, stdout: Buffer.concat(stdout).toString(), stderr: Buffer.concat(stderr).toString() }))
  })
}

test('portal auth, static bootstrap, exact BFF routes, and remembered sessions', async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), 'lazying-game-portal-'))
  const secretDirectory = join(temporary, 'secrets')
  const stateDirectory = join(temporary, 'state')
  const releaseDirectory = join(temporary, 'release')
  await mkdir(secretDirectory, { mode: 0o700 })
  await mkdir(stateDirectory, { mode: 0o700 })
  await mkdir(releaseDirectory, { mode: 0o755 })
  for (const product of PRODUCTS) {
    const directory = join(releaseDirectory, product)
    await mkdir(join(directory, 'assets'), { recursive: true, mode: 0o755 })
    await writeFile(join(directory, 'index.html'), `<!doctype html><html><head><title>${product}</title><script type="module" src="./assets/app.js"></script></head><body>${product}</body></html>`)
    await writeFile(join(directory, 'assets/app.js'), `window.product=${JSON.stringify(product)};\n${'/* reviewed asset */'.repeat(100)}`)
    await writeFile(join(directory, 'sw.js'), 'self.addEventListener("fetch",()=>{});\n')
    await writeFile(join(directory, 'manifest.webmanifest'), '{"name":"reviewed test app"}\n')
  }
  const verifier = await makeScryptVerifier('correct horse battery staple', { N: 16_384 })
  const verifierFile = join(secretDirectory, 'password.json')
  const tokenFile = join(secretDirectory, 'dispatch-token')
  const sessionSecretFile = join(secretDirectory, 'session-secret')
  await writeFile(verifierFile, `${JSON.stringify(passwordRecord('lachlanchen', verifier))}\n`, { mode: 0o600 })
  await writeFile(tokenFile, `${randomBytes(32).toString('base64url')}\n`, { mode: 0o600 })
  await writeFile(sessionSecretFile, `${randomBytes(48).toString('base64url')}\n`, { mode: 0o600 })

  const gatewayCalls = []
  const gateway = createHttpServer(async (incoming, outgoing) => {
    const chunks = []
    for await (const chunk of incoming) chunks.push(chunk)
    gatewayCalls.push({
      method: incoming.method,
      url: incoming.url,
      headers: incoming.headers,
      envelope: JSON.parse(Buffer.concat(chunks).toString('utf8')),
    })
    outgoing.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'private' })
    outgoing.end(JSON.stringify({ ok: true, product: gatewayCalls.at(-1).envelope.product }))
  })
  const gatewayPort = await listen(gateway)
  const rawConfig = {
    schema: 'lazyingart.game-portal.config.v1',
    releaseId: 'test-release-0001',
    listen: { host: '127.0.0.1', port: 18_620 },
    publicOrigin: 'https://game.example.test',
    username: 'lachlanchen',
    releaseDir: releaseDirectory,
    lazyEdge: { dispatchUrl: `http://127.0.0.1:${gatewayPort}/v1/game/dispatch`, tokenFile },
    auth: {
      passwordVerifierFile: verifierFile,
      sessionSecretFile,
      sessionStoreFile: join(stateDirectory, 'sessions.json'),
      sessionHours: 8,
      rememberDays: 30,
      maxRememberedSessions: 8,
    },
    limits: {
      requestBodyBytes: 1_048_576,
      upstreamResponseBytes: 1_048_576,
      upstreamTimeoutSeconds: 10,
      upstreamConcurrency: 2,
      apiRequestsPerMinute: 100,
      loginAttemptsPer15Minutes: 6,
      globalLoginAttemptsPer15Minutes: 20,
    },
  }
  const config = await normalizeConfig(rawConfig)
  const credentials = await loadCredentials(config)
  const newRegistry = () => new SessionRegistry({
    secret: credentials.sessionSecret,
    storeFile: config.auth.sessionStoreFile,
    username: config.username,
    sessionHours: config.auth.sessionHours,
    rememberDays: config.auth.rememberDays,
    maxRememberedSessions: config.auth.maxRememberedSessions,
  })
  const sessions = await newRegistry().init()
  const portal = createPortalServer({ config, credentials, sessions })
  const portalPort = await listen(portal)
  t.after(async () => {
    await close(portal)
    await close(gateway)
    await rm(temporary, { recursive: true, force: true })
  })

  await t.test('health is minimal and the unauthenticated root opens the read-only Weiqi spectator', async () => {
    const health = await request(portalPort, '/healthz')
    assert.equal(health.status, 200)
    assert.deepEqual(JSON.parse(health.text), { ok: true, service: 'lazying-game-web', release: 'test-release-0001' })
    assert.equal(health.headers['cache-control'], 'no-store')
    const denied = await request(portalPort, '/api/status')
    assert.equal(denied.status, 401)
    assert.equal(JSON.parse(denied.text).code, 'authentication_required')
    const entry = await request(portalPort, '/')
    assert.equal(entry.status, 303)
    assert.equal(entry.headers.location, '/weiqi/?view=spectate&autoplay=1')
    assert.equal(entry.headers['set-cookie'], undefined)
  })

  await t.test('public spectator assets and archive GETs are narrow, cookie-free, and mutation-free', async () => {
    const spectator = await request(portalPort, '/weiqi/?view=spectate&autoplay=1', { headers: { Accept: 'text/html' } })
    assert.equal(spectator.status, 200)
    assert.equal(spectator.headers['cache-control'], 'no-store')
    assert.equal(spectator.headers.vary, undefined)
    assert.ok(spectator.text.includes('type="module"'))
    assert.ok(!spectator.text.includes('/portal/bootstrap.js'))
    assert.equal(spectator.headers['set-cookie'], undefined)

    const asset = await request(portalPort, '/weiqi/assets/app.js', { headers: { 'Accept-Encoding': 'gzip' } })
    assert.equal(asset.status, 200)
    assert.equal(asset.headers['cache-control'], 'public, max-age=31536000, immutable')
    assert.equal(asset.headers.vary, 'Accept-Encoding')
    assert.equal(asset.headers['content-encoding'], 'gzip')

    const list = await request(portalPort, '/api/public/weiqi/games?limit=20&cursor=next-page', {
      headers: { Cookie: '__Host-game_session=untrusted-browser-state' },
    })
    assert.equal(list.status, 200)
    assert.deepEqual(gatewayCalls.at(-1).envelope, {
      schema: 'lazyingart.game-dispatch.v1',
      product: 'weiqi',
      method: 'GET',
      path: '/api/public/weiqi/games',
      query: { limit: 20, cursor: 'next-page' },
    })
    assert.equal(gatewayCalls.at(-1).headers.cookie, undefined)

    const publicId = `wq_${'a'.repeat(32)}`
    const detail = await request(portalPort, `/api/public/weiqi/games/${publicId}`)
    assert.equal(detail.status, 200)
    assert.deepEqual(gatewayCalls.at(-1).envelope, {
      schema: 'lazyingart.game-dispatch.v1',
      product: 'weiqi',
      method: 'GET',
      path: `/api/public/weiqi/games/${publicId}`,
    })

    assert.equal((await request(portalPort, '/api/public/weiqi/games', { method: 'POST' })).status, 405)
    assert.equal((await request(portalPort, '/api/public/weiqi/games/private')).status, 404)
    assert.equal((await request(portalPort, '/api/public/weiqi/games?limit=51')).status, 400)
    assert.equal((await request(portalPort, '/api/public/weiqi/games', { body: '{}' })).status, 400)
    assert.equal((await request(portalPort, '/weiqi/assets/app.js?private=1')).status, 400)

    const normalPlay = await request(portalPort, '/weiqi/?view=learn&board=19')
    assert.equal(normalPlay.status, 303)
    assert.equal(normalPlay.headers.location, '/login?next=%2Fweiqi%2F%3Fview%3Dlearn%26board%3D19')
    assert.equal((await request(portalPort, '/api/session')).status, 401)
    gatewayCalls.length = 0
  })

  await t.test('login challenge remains valid through the full failure window', () => {
    const issuedAt = 1_788_000_000_000
    const challenge = sessions.newLoginChallenge(issuedAt)
    assert.match(challenge.cookie, /; Max-Age=1200/)
    assert.equal(sessions.verifyLoginChallenge(challenge.value, challenge.value, issuedAt + (15 * 60 * 1000)), true)
    assert.equal(sessions.verifyLoginChallenge(challenge.value, challenge.value, issuedAt + (20 * 60 * 1000)), false)
  })

  await t.test('root favicon is public, cacheable, HEAD-safe, and method-bounded', async () => {
    const icon = await request(portalPort, '/favicon.svg')
    assert.equal(icon.status, 200)
    assert.equal(icon.headers['content-type'], 'image/svg+xml; charset=utf-8')
    assert.equal(icon.headers['cache-control'], 'public, max-age=86400, stale-while-revalidate=604800')
    assert.equal(Number(icon.headers['content-length']), icon.body.length)
    assert.match(icon.text, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
    assert.equal(icon.headers['set-cookie'], undefined)

    const iconHead = await request(portalPort, '/favicon.svg', { method: 'HEAD' })
    assert.equal(iconHead.status, 200)
    assert.equal(iconHead.headers['content-type'], icon.headers['content-type'])
    assert.equal(iconHead.headers['cache-control'], icon.headers['cache-control'])
    assert.equal(iconHead.headers['content-length'], icon.headers['content-length'])
    assert.equal(iconHead.body.length, 0)

    for (const method of ['GET', 'HEAD']) {
      const legacy = await request(portalPort, '/favicon.ico', { method })
      assert.equal(legacy.status, 308)
      assert.equal(legacy.headers.location, '/favicon.svg')
      assert.equal(legacy.headers['cache-control'], icon.headers['cache-control'])
      assert.equal(legacy.body.length, 0)
    }

    for (const path of ['/favicon.svg', '/favicon.ico']) {
      const rejected = await request(portalPort, path, { method: 'POST' })
      assert.equal(rejected.status, 405)
      assert.equal(rejected.headers.allow, 'GET, HEAD')
    }
  })

  let sessionCookie
  let csrfToken
  await t.test('login uses signed challenge, scrypt, and strict remembered cookie', async () => {
    const login = await request(portalPort, '/login?next=%2Fweiqi%2F')
    assert.equal(login.status, 200)
    assert.equal(login.headers['referrer-policy'], 'same-origin')
    assert.ok(login.text.includes('<link rel="icon" href="/favicon.svg" type="image/svg+xml">'))
    const loginCookie = cookieFrom(login.headers, '__Host-game_login')
    const badCsrf = await request(portalPort, '/auth/login', {
      method: 'POST',
      headers: {
        Cookie: loginCookie,
        Origin: config.publicOrigin,
        'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ csrf: 'wrong', username: 'lachlanchen', password: 'correct horse battery staple', next: '/' }).toString(),
    })
    assert.equal(badCsrf.status, 403)
    assert.match(badCsrf.text, /expired or was replaced by a newer tab/)
    const refreshedChallenge = hidden(badCsrf.text, 'csrf')
    const refreshedLoginCookie = cookieFrom(badCsrf.headers, '__Host-game_login')
    const accepted = await request(portalPort, '/auth/login', {
      method: 'POST',
      headers: {
        Cookie: refreshedLoginCookie,
        Origin: config.publicOrigin,
        'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ csrf: refreshedChallenge, username: 'lachlanchen', password: 'correct horse battery staple', remember: 'yes', next: '/weiqi/' }).toString(),
    })
    assert.equal(accepted.status, 303)
    assert.equal(accepted.headers.location, '/weiqi/')
    sessionCookie = cookieFrom(accepted.headers, '__Host-game_session')
    const sessionSetCookie = accepted.headers['set-cookie'].find((value) => value.startsWith('__Host-game_session='))
    assert.match(sessionSetCookie, /; Secure; HttpOnly; SameSite=Strict;/)
    assert.match(sessionSetCookie, /; Max-Age=2592000/)
    const session = await request(portalPort, '/api/session', { headers: { Cookie: sessionCookie } })
    assert.equal(session.status, 200)
    csrfToken = JSON.parse(session.text).csrfToken
    assert.match(csrfToken, /^[A-Za-z0-9_-]{43}$/)
    assert.doesNotMatch(await readFile(config.auth.sessionStoreFile, 'utf8'), /__Host-game_session|correct horse|session-secret/)
    assert.equal((await stat(config.auth.sessionStoreFile)).mode & 0o777, 0o600)
  })

  const loginAttempt = async ({
    address,
    password = 'correct horse battery staple',
    username = 'lachlanchen',
  } = {}) => {
    const login = await request(portalPort, '/login')
    assert.equal(login.status, 200)
    return await request(portalPort, '/auth/login', {
      method: 'POST',
      headers: {
        Cookie: cookieFrom(login.headers, '__Host-game_login'),
        Origin: config.publicOrigin,
        'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(address ? { 'X-Lazying-Client-Address': address } : {}),
      },
      body: new URLSearchParams({
        csrf: hidden(login.text, 'csrf'),
        username,
        password,
        next: '/',
      }).toString(),
    })
  }

  await t.test('repeated successful acceptance logins do not spend client or global failure budgets', async () => {
    const successes = config.limits.globalLoginAttemptsPer15Minutes + 2
    for (let index = 0; index < successes; index += 1) {
      const accepted = await loginAttempt({ address: '198.51.100.10' })
      assert.equal(accepted.status, 303, `successful login ${index + 1} was unexpectedly limited`)
      assert.equal(accepted.headers.location, '/')
    }
  })

  await t.test('stale one-time forms refresh without spending either failure budget', async () => {
    const address = '198.51.100.11'
    const attempts = config.limits.globalLoginAttemptsPer15Minutes + 2
    for (let index = 0; index < attempts; index += 1) {
      const login = await request(portalPort, '/login')
      const refreshed = await request(portalPort, '/auth/login', {
        method: 'POST',
        headers: {
          Cookie: cookieFrom(login.headers, '__Host-game_login'),
          Origin: config.publicOrigin,
          'Sec-Fetch-Site': 'same-origin',
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Lazying-Client-Address': address,
        },
        body: new URLSearchParams({
          csrf: 'stale-form-token',
          username: 'lachlanchen',
          password: 'not-evaluated',
          next: '/',
        }).toString(),
      })
      assert.equal(refreshed.status, 403)
      assert.match(refreshed.text, /expired or was replaced by a newer tab/)
    }
    const accepted = await loginAttempt({ address })
    assert.equal(accepted.status, 303)
    assert.equal(accepted.headers.location, '/')
  })

  await t.test('UTF-8 password and malformed native-form bounds return recoverable HTML', async () => {
    const maximumValidUtf8 = await loginAttempt({
      address: '198.51.100.12',
      password: '界'.repeat(1365),
    })
    assert.equal(maximumValidUtf8.status, 401)
    assert.match(maximumValidUtf8.text, /sign-in details were not accepted/)

    const oversizedNativeForm = await loginAttempt({
      address: '198.51.100.13',
      password: '界'.repeat(3000),
    })
    assert.equal(oversizedNativeForm.status, 413)
    assert.match(oversizedNativeForm.headers['content-type'], /^text\/html/)
    assert.match(oversizedNativeForm.text, /too large or malformed/)
    assert.match(oversizedNativeForm.text, /name="csrf" value="[^\"]+"/)
  })

  await t.test('client failure budget blocks a later valid password and supplies Retry-After', async () => {
    const address = '198.51.100.20'
    for (let index = 0; index < config.limits.loginAttemptsPer15Minutes; index += 1) {
      const rejected = await loginAttempt({ address, password: 'not-the-password' })
      assert.equal(rejected.status, 401, `failure ${index + 1} should reach bounded verification`)
    }
    const blocked = await loginAttempt({ address })
    assert.equal(blocked.status, 429)
    assert.match(blocked.text, /Too many incorrect sign-in attempts/)
    assert.match(blocked.text, /name="csrf" value="[^\"]+"/)
    assert.match(blocked.headers['retry-after'], /^\d+$/)
    assert.ok(Number(blocked.headers['retry-after']) >= 1)
    assert.ok(Number(blocked.headers['retry-after']) <= 900)
  })

  await t.test('concurrent invalid credentials cannot share the final client failure slot', async () => {
    const address = '198.51.100.21'
    for (let index = 0; index < config.limits.loginAttemptsPer15Minutes - 1; index += 1) {
      const rejected = await loginAttempt({ address, password: 'not-the-password' })
      assert.equal(rejected.status, 401)
    }
    const finalSlot = await Promise.all([
      loginAttempt({ address, password: 'still-not-the-password' }),
      loginAttempt({ address, password: 'also-not-the-password' }),
    ])
    assert.deepEqual(finalSlot.map((result) => result.status).sort(), [401, 429])
    assert.match(finalSlot.find((result) => result.status === 429)?.text ?? '', /Too many incorrect sign-in attempts/)
  })

  await t.test('SPA index injects bootstrap before modules and wrapper limits CSRF to same-origin state changes', async () => {
    const portalHome = await request(portalPort, '/', { headers: { Cookie: sessionCookie } })
    assert.equal(portalHome.status, 200)
    assert.ok(portalHome.text.includes('/weiqi/?view=learn&amp;board=19'))
    assert.ok(portalHome.text.includes('/weiqi/?view=learn&amp;board=7'))
    assert.ok(portalHome.text.includes('<link rel="icon" href="/favicon.svg" type="image/svg+xml">'))
    assert.ok(!portalHome.text.includes('style="'))
    const index = await request(portalPort, '/weiqi/', { headers: { Cookie: sessionCookie, Accept: 'text/html' } })
    assert.equal(index.status, 200)
    assert.equal(index.headers['cache-control'], 'no-store')
    assert.ok(index.text.indexOf('/portal/bootstrap.js') < index.text.indexOf('type="module"'))
    const bootstrap = await request(portalPort, '/portal/bootstrap.js', { headers: { Cookie: sessionCookie } })
    assert.equal(bootstrap.status, 200)
    assert.equal(bootstrap.headers['cache-control'], 'no-store')
    assert.ok(bootstrap.text.includes(csrfToken))
    const calls = []
    const browserWindow = {
      location: new URL('https://game.example.test/weiqi/'),
      fetch: async (input, init) => {
        calls.push({ input, init })
        return { ok: true }
      },
    }
    vm.runInNewContext(bootstrap.text, {
      window: browserWindow,
      URL,
      Headers,
      Request,
      Set,
    })
    await browserWindow.fetch('/api/games', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    assert.equal(calls[0].init.headers.get('X-Game-CSRF'), csrfToken)
    await browserWindow.fetch('https://elsewhere.invalid/api/games', { method: 'POST', body: '{}' })
    assert.equal(calls[1].init.headers?.get?.('X-Game-CSRF'), undefined)
    await browserWindow.fetch('/api/status')
    assert.equal(calls[2].init.headers, undefined)
  })

  await t.test('password verification has a strict two-worker concurrency bound', async () => {
    const attempt = async () => {
      const login = await request(portalPort, '/login')
      const challenge = hidden(login.text, 'csrf')
      const challengeCookie = cookieFrom(login.headers, '__Host-game_login')
      return await request(portalPort, '/auth/login', {
        method: 'POST',
        headers: {
          Cookie: challengeCookie,
          Origin: config.publicOrigin,
          'Sec-Fetch-Site': 'same-origin',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          csrf: challenge,
          username: 'lachlanchen',
          password: 'not-the-password',
          next: '/',
        }).toString(),
      })
    }
    const results = await Promise.all([attempt(), attempt(), attempt()])
    assert.deepEqual(results.map((result) => result.status).sort(), [401, 401, 503])
    assert.equal(results.find((result) => result.status === 503)?.headers['retry-after'], '2')
  })

  await t.test('global failure budget blocks a clean client and supplies Retry-After', async () => {
    // Stale challenges do not spend the budget. The dedicated client failures
    // above and two completed bounded-worker failures have spent part of the
    // global budget. Fill only the exact remainder from clean addresses.
    const alreadyFailed = (2 * config.limits.loginAttemptsPer15Minutes) + 3
    const remaining = config.limits.globalLoginAttemptsPer15Minutes - alreadyFailed
    for (let index = 0; index < remaining; index += 1) {
      const rejected = await loginAttempt({
        address: `203.0.113.${index + 1}`,
        password: 'not-the-password',
      })
      assert.equal(rejected.status, 401)
    }
    const blocked = await loginAttempt({ address: '192.0.2.200' })
    assert.equal(blocked.status, 429)
    assert.match(blocked.text, /Too many incorrect sign-in attempts/)
    assert.match(blocked.headers['retry-after'], /^\d+$/)
    assert.ok(Number(blocked.headers['retry-after']) >= 1)
    assert.ok(Number(blocked.headers['retry-after']) <= 900)
  })

  await t.test('real Weiqi, Chess, and Poker POSTs require CSRF and become exact dispatch envelopes', async () => {
    const baseHeaders = {
      Cookie: sessionCookie,
      Origin: config.publicOrigin,
      'Sec-Fetch-Site': 'same-origin',
      'Content-Type': 'application/json',
    }
    const missing = await request(portalPort, '/api/games', { method: 'POST', headers: baseHeaders, body: '{}' })
    assert.equal(missing.status, 403)
    assert.equal(gatewayCalls.length, 0)
    const crossOrigin = await request(portalPort, '/api/games', {
      method: 'POST',
      headers: { ...baseHeaders, Origin: 'https://attacker.invalid', 'X-Game-CSRF': csrfToken },
      body: '{}',
    })
    assert.equal(crossOrigin.status, 403)
    const acceptedHeaders = { ...baseHeaders, 'X-Game-CSRF': csrfToken }
    const scalar = await request(portalPort, '/api/games', { method: 'POST', headers: acceptedHeaders, body: '1' })
    assert.equal(scalar.status, 400)
    assert.equal(JSON.parse(scalar.text).code, 'invalid_json_object')
    for (const [path, body, product] of [
      ['/api/games', { board_size: 19 }, 'weiqi'],
      ['/api/engine-analysis', { variant: 'xiangqi' }, 'chess'],
      ['/api/douzero/analyze', { schema: 'lazy-poker.douzero-request.v1' }, 'poker'],
    ]) {
      const accepted = await request(portalPort, path, { method: 'POST', headers: acceptedHeaders, body: JSON.stringify(body) })
      assert.equal(accepted.status, 200)
      assert.equal(JSON.parse(accepted.text).product, product)
    }
    assert.deepEqual(gatewayCalls.map((call) => call.envelope), [
      { schema: 'lazyingart.game-dispatch.v1', product: 'weiqi', method: 'POST', path: '/api/games', body: { board_size: 19 } },
      { schema: 'lazyingart.game-dispatch.v1', product: 'chess', method: 'POST', path: '/api/engine-analysis', body: { variant: 'xiangqi' } },
      { schema: 'lazyingart.game-dispatch.v1', product: 'poker', method: 'POST', path: '/api/douzero/analyze', body: { schema: 'lazy-poker.douzero-request.v1' } },
    ])
    for (const call of gatewayCalls) {
      assert.equal(call.method, 'POST')
      assert.equal(call.url, '/v1/game/dispatch')
      assert.match(call.headers.authorization, /^Bearer [A-Za-z0-9._~-]+$/)
      assert.equal(call.headers.cookie, undefined)
      assert.equal(call.headers['x-game-csrf'], undefined)
    }
  })

  await t.test('queries, methods, traversal, private endpoints, and assets are bounded', async () => {
    const listed = await request(portalPort, '/api/games?limit=20&cursor=next-page', { headers: { Cookie: sessionCookie } })
    assert.equal(listed.status, 200)
    assert.deepEqual(gatewayCalls.at(-1).envelope, {
      schema: 'lazyingart.game-dispatch.v1',
      product: 'weiqi',
      method: 'GET',
      path: '/api/games',
      query: { limit: 20, cursor: 'next-page' },
    })
    assert.equal((await request(portalPort, '/api/games?target=http://attacker.invalid', { headers: { Cookie: sessionCookie } })).status, 400)
    assert.equal((await request(portalPort, '/api/games?cursor=opaque%2Bcursor', { headers: { Cookie: sessionCookie } })).status, 400)
    assert.equal((await request(portalPort, '/api/douzero/private', { headers: { Cookie: sessionCookie } })).status, 404)
    assert.equal((await request(portalPort, '/api/engine-analysis', { headers: { Cookie: sessionCookie } })).status, 405)
    assert.equal((await request(portalPort, '/weiqi/%2e%2e/chess/index.html', { headers: { Cookie: sessionCookie } })).status, 400)
    const asset = await request(portalPort, '/weiqi/assets/app.js', { headers: { Cookie: sessionCookie, 'Accept-Encoding': 'gzip' } })
    assert.equal(asset.status, 200)
    assert.equal(asset.headers['content-encoding'], 'gzip')
    assert.equal(asset.headers['cache-control'], 'public, max-age=31536000, immutable')
    const worker = await request(portalPort, '/weiqi/sw.js', { headers: { Cookie: sessionCookie } })
    assert.equal(worker.status, 200)
    assert.equal(worker.headers['cache-control'], 'no-store')
    const manifest = await request(portalPort, '/weiqi/manifest.webmanifest', { headers: { Cookie: sessionCookie } })
    assert.equal(manifest.status, 200)
    assert.equal(manifest.headers['cache-control'], 'no-store')
  })

  await t.test('remembered session survives registry restart and logout revokes it durably', async () => {
    const restarted = await newRegistry().init()
    assert.ok(restarted.authenticate(sessionCookie))
    const logout = await request(portalPort, '/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: sessionCookie,
        Origin: config.publicOrigin,
        'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ csrf: csrfToken }).toString(),
    })
    assert.equal(logout.status, 303)
    const afterLogout = await newRegistry().init()
    assert.equal(afterLogout.authenticate(sessionCookie), null)
  })
})

test('hash-password CLI accepts private file input, never argv plaintext, and writes 0600 JSON without revealing verifier', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'lazying-game-hash-'))
  try {
    const input = join(temporary, 'input.json')
    const output = join(temporary, 'verifier.json')
    await writeFile(input, `${JSON.stringify({ version: 1, username: 'lachlanchen', password: 'never-print-this-password' })}\n`, { mode: 0o600 })
    const result = await run(process.execPath, [
      './bin/game-portal.mjs',
      'hash-password',
      '--password-file', input,
      '--out', output,
      '--username', 'lachlanchen',
    ], new URL('..', import.meta.url).pathname)
    assert.equal(result.code, 0, result.stderr)
    assert.doesNotMatch(result.stdout, /never-print|scrypt\$/)
    assert.equal((await stat(output)).mode & 0o777, 0o600)
    const parsed = JSON.parse(await readFile(output, 'utf8'))
    assert.equal(parsed.schema, 'lazyingart.game-portal.password.v1')
    assert.equal(parsed.username, 'lachlanchen')
    assert.match(parsed.verifier, /^scrypt\$/)
    const repeat = await run(process.execPath, [
      './bin/game-portal.mjs',
      'hash-password',
      '--password-file', input,
      '--out', output,
      '--username', 'lachlanchen',
    ], new URL('..', import.meta.url).pathname)
    assert.notEqual(repeat.code, 0)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})

test('bounded compute queue removes a request when its browser aborts', async () => {
  const semaphore = new BoundedSemaphore(1, 2)
  const release = await semaphore.acquire()
  const controller = new AbortController()
  const queued = semaphore.acquire(controller.signal)
  controller.abort()
  await assert.rejects(queued, /UPSTREAM_ACQUIRE_ABORTED/)
  assert.equal(semaphore.queue.length, 0)
  release()
  assert.equal(semaphore.active, 0)
  const releaseAgain = await semaphore.acquire()
  releaseAgain()
  assert.equal(semaphore.active, 0)
})

test('fixed-window checks are non-consuming and failures reset only after the window', () => {
  const limiter = new FixedWindowRateLimiter({ limit: 2, windowMs: 15_000, maxEntries: 2 })
  for (let index = 0; index < 20; index += 1) {
    assert.deepEqual(limiter.check('client', 1_000), { allowed: true, retryAfterSeconds: 15 })
  }
  assert.equal(limiter.entries.size, 0)
  assert.equal(limiter.consume('client', 1_000).allowed, true)
  assert.equal(limiter.check('client', 2_000).allowed, true)
  assert.equal(limiter.consume('client', 2_000).allowed, true)
  assert.deepEqual(limiter.check('client', 3_000), { allowed: false, retryAfterSeconds: 13 })
  assert.deepEqual(limiter.consume('client', 3_000), { allowed: false, retryAfterSeconds: 13 })
  assert.deepEqual(limiter.check('client', 16_000), { allowed: true, retryAfterSeconds: 15 })
  assert.equal(limiter.entries.size, 0)
})

test('fixed-window reservations bind concurrent work to remaining failure slots', () => {
  const limiter = new FixedWindowRateLimiter({ limit: 2, windowMs: 15_000 })
  const first = limiter.reserve('client', 1_000)
  const second = limiter.reserve('client', 1_000)
  assert.equal(first.allowed, true)
  assert.equal(second.allowed, true)
  assert.deepEqual(limiter.check('client', 1_000), { allowed: false, retryAfterSeconds: 15 })
  assert.deepEqual(limiter.reserve('client', 1_000), { allowed: false, retryAfterSeconds: 15 })

  limiter.commit(first.reservation)
  limiter.release(second.reservation)
  assert.equal(limiter.check('client', 2_000).allowed, true)
  const final = limiter.reserve('client', 2_000)
  assert.equal(final.allowed, true)
  limiter.commit(final.reservation)
  assert.equal(limiter.check('client', 3_000).allowed, false)
  assert.throws(() => limiter.release(final.reservation), /invalid or already settled/)

  const released = new FixedWindowRateLimiter({ limit: 2, windowMs: 15_000 })
  const unused = released.reserve('successful-client', 1_000)
  released.release(unused.reservation)
  assert.equal(released.entries.size, 0)
})

test('systemd credential materialization accepts only root-owned protected modes', () => {
  const regular = (uid, mode) => ({ uid, mode, isFile: () => true })
  const directory = (uid, mode) => ({ uid, mode, isDirectory: () => true })
  assert.equal(trustedSystemdCredentialFileMetadata(regular(0, 0o100440)), true)
  assert.equal(trustedSystemdCredentialFileMetadata(regular(0, 0o100400)), true)
  assert.equal(trustedSystemdCredentialFileMetadata(regular(1000, 0o100440)), false)
  assert.equal(trustedSystemdCredentialFileMetadata(regular(0, 0o100444)), false)
  assert.equal(trustedSystemdCredentialDirectoryMetadata(directory(0, 0o40550)), true)
  assert.equal(trustedSystemdCredentialDirectoryMetadata(directory(0, 0o40750)), true)
  assert.equal(trustedSystemdCredentialDirectoryMetadata(directory(1000, 0o40550)), false)
  assert.equal(trustedSystemdCredentialDirectoryMetadata(directory(0, 0o40770)), false)
})
