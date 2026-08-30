import { constants as fsConstants } from 'node:fs'
import { open, realpath, stat } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { parsePasswordRecord, readPrivateText } from './security.mjs'

const CONFIG_SCHEMA = 'lazyingart.game-portal.config.v1'
export const PRODUCTS = Object.freeze(['weiqi', 'chess', 'mahjong', 'poker'])

function object(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${label} contains unknown field ${key}`)
  return value
}

function string(value, label, { pattern, min = 1, max = 1024 } = {}) {
  if (typeof value !== 'string' || value.length < min || value.length > max || (pattern && !pattern.test(value))) {
    throw new Error(`${label} is invalid`)
  }
  return value
}

function integer(value, label, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} is invalid`)
  return value
}

function absolutePath(value, label) {
  string(value, label, { max: 4096 })
  if (!isAbsolute(value) || value.includes('\0')) throw new Error(`${label} must be an absolute path`)
  return value
}

async function readConfigFile(filePath) {
  absolutePath(filePath, 'Configuration path')
  const handle = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
  try {
    const metadata = await handle.stat()
    if (!metadata.isFile() || metadata.size < 2 || metadata.size > 65_536) throw new Error('Configuration must be a bounded regular file')
    return await handle.readFile({ encoding: 'utf8' })
  } finally {
    await handle.close()
  }
}

async function validateReleaseDirectory(releaseDir) {
  const resolved = await realpath(releaseDir)
  if (resolved !== releaseDir) throw new Error('releaseDir must identify an immutable directory directly, not a symlink')
  const root = await stat(releaseDir)
  if (!root.isDirectory()) throw new Error('releaseDir must be a directory')
  for (const product of PRODUCTS) {
    const directory = join(releaseDir, product)
    const productResolved = await realpath(directory)
    if (productResolved !== directory) throw new Error(`${product} release directory must not be a symlink`)
    if (!(await stat(directory)).isDirectory()) throw new Error(`${product} release directory is missing`)
    const indexPath = join(directory, 'index.html')
    if (!(await stat(indexPath)).isFile()) throw new Error(`${product} release index.html is missing`)
  }
}

export async function normalizeConfig(untrusted, { validateRelease = true } = {}) {
  const config = object(untrusted, [
    'schema',
    'releaseId',
    'listen',
    'publicOrigin',
    'username',
    'releaseDir',
    'lazyEdge',
    'auth',
    'limits',
  ], 'Configuration')
  if (config.schema !== CONFIG_SCHEMA) throw new Error('Configuration schema is invalid')
  const listen = object(config.listen, ['host', 'port'], 'listen')
  if (listen.host !== '127.0.0.1') throw new Error('Portal listener must remain on 127.0.0.1')
  integer(listen.port, 'listen.port', 1024, 65_535)
  const origin = new URL(string(config.publicOrigin, 'publicOrigin', { max: 512 }))
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || origin.port) {
    throw new Error('publicOrigin must be an origin-only HTTPS URL on the default port')
  }
  const username = string(config.username, 'username', { pattern: /^[A-Za-z0-9._-]{1,64}$/ })
  const releaseDir = absolutePath(config.releaseDir, 'releaseDir')
  if (validateRelease) await validateReleaseDirectory(releaseDir)
  const lazyEdge = object(config.lazyEdge, ['dispatchUrl', 'tokenFile'], 'lazyEdge')
  const dispatchUrl = new URL(string(lazyEdge.dispatchUrl, 'lazyEdge.dispatchUrl', { max: 512 }))
  if (
    dispatchUrl.protocol !== 'http:'
    || dispatchUrl.hostname !== '127.0.0.1'
    || !dispatchUrl.port
    || dispatchUrl.pathname !== '/v1/game/dispatch'
    || dispatchUrl.username
    || dispatchUrl.password
    || dispatchUrl.search
    || dispatchUrl.hash
  ) throw new Error('lazyEdge.dispatchUrl must be the fixed loopback /v1/game/dispatch endpoint')
  integer(Number(dispatchUrl.port), 'lazyEdge.dispatchUrl port', 1024, 65_535)
  const auth = object(config.auth, [
    'passwordVerifierFile',
    'sessionSecretFile',
    'sessionStoreFile',
    'sessionHours',
    'rememberDays',
    'maxRememberedSessions',
  ], 'auth')
  const limits = object(config.limits, [
    'requestBodyBytes',
    'upstreamResponseBytes',
    'upstreamTimeoutSeconds',
    'upstreamConcurrency',
    'apiRequestsPerMinute',
    'loginAttemptsPer15Minutes',
    'globalLoginAttemptsPer15Minutes',
  ], 'limits')
  return Object.freeze({
    schema: CONFIG_SCHEMA,
    releaseId: string(config.releaseId, 'releaseId', { pattern: /^[A-Za-z0-9._-]{8,128}$/ }),
    listen: Object.freeze({ host: listen.host, port: listen.port }),
    publicOrigin: origin.origin,
    publicHost: origin.host,
    username,
    releaseDir,
    lazyEdge: Object.freeze({
      dispatchUrl: dispatchUrl.href,
      tokenFile: absolutePath(lazyEdge.tokenFile, 'lazyEdge.tokenFile'),
    }),
    auth: Object.freeze({
      passwordVerifierFile: absolutePath(auth.passwordVerifierFile, 'auth.passwordVerifierFile'),
      sessionSecretFile: absolutePath(auth.sessionSecretFile, 'auth.sessionSecretFile'),
      sessionStoreFile: absolutePath(auth.sessionStoreFile, 'auth.sessionStoreFile'),
      sessionHours: integer(auth.sessionHours, 'auth.sessionHours', 1, 24),
      rememberDays: integer(auth.rememberDays, 'auth.rememberDays', 1, 90),
      maxRememberedSessions: integer(auth.maxRememberedSessions, 'auth.maxRememberedSessions', 1, 1024),
    }),
    limits: Object.freeze({
      requestBodyBytes: integer(limits.requestBodyBytes, 'limits.requestBodyBytes', 1024, 32 * 1024 * 1024),
      upstreamResponseBytes: integer(limits.upstreamResponseBytes, 'limits.upstreamResponseBytes', 1024, 64 * 1024 * 1024),
      upstreamTimeoutSeconds: integer(limits.upstreamTimeoutSeconds, 'limits.upstreamTimeoutSeconds', 1, 900),
      upstreamConcurrency: integer(limits.upstreamConcurrency, 'limits.upstreamConcurrency', 1, 16),
      apiRequestsPerMinute: integer(limits.apiRequestsPerMinute, 'limits.apiRequestsPerMinute', 10, 1200),
      loginAttemptsPer15Minutes: integer(limits.loginAttemptsPer15Minutes, 'limits.loginAttemptsPer15Minutes', 1, 30),
      globalLoginAttemptsPer15Minutes: integer(limits.globalLoginAttemptsPer15Minutes, 'limits.globalLoginAttemptsPer15Minutes', 1, 300),
    }),
  })
}

export async function loadConfig(filePath) {
  const raw = await readConfigFile(filePath)
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Configuration JSON is invalid')
  }
  return await normalizeConfig(parsed)
}

export async function loadCredentials(config) {
  const credentialOptions = { minBytes: 32, maxBytes: 4096, allowSystemdCredential: true }
  const tokenRaw = await readPrivateText(config.lazyEdge.tokenFile, 'Game dispatch token', credentialOptions)
  const token = tokenRaw.endsWith('\r\n') ? tokenRaw.slice(0, -2) : tokenRaw.endsWith('\n') ? tokenRaw.slice(0, -1) : tokenRaw
  if (!/^[A-Za-z0-9._~-]{32,4096}$/.test(token)) throw new Error('Game dispatch token is not a valid capability')
  const secretRaw = await readPrivateText(config.auth.sessionSecretFile, 'Portal session secret', credentialOptions)
  const secretText = secretRaw.endsWith('\r\n') ? secretRaw.slice(0, -2) : secretRaw.endsWith('\n') ? secretRaw.slice(0, -1) : secretRaw
  if (!/^[A-Za-z0-9._~-]{32,4096}$/.test(secretText)) throw new Error('Portal session secret is invalid')
  const verifierRaw = await readPrivateText(config.auth.passwordVerifierFile, 'Password verifier', {
    maxBytes: 8192,
    allowSystemdCredential: true,
  })
  const password = parsePasswordRecord(verifierRaw, config.username)
  return Object.freeze({ token, sessionSecret: Buffer.from(secretText, 'utf8'), password })
}
