import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'
import { constants as fsConstants } from 'node:fs'
import { open, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute } from 'node:path'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const PRIVATE_MODE_MASK = 0o077
const PASSWORD_SCHEMA = 'lazyingart.game-portal.password.v1'
const VERIFIER_PATTERN = /^scrypt\$([0-9]+)\$([0-9]+)\$([0-9]+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/

function assertPrivateMetadata(metadata, label, { allowRootOwner = true, systemdCredential = false } = {}) {
  if (!metadata.isFile()) throw new Error(`${label} must be a regular file`)
  if (systemdCredential) {
    if (!trustedSystemdCredentialFileMetadata(metadata)) {
      throw new Error(`${label} has invalid systemd credential ownership or mode`)
    }
    return
  }
  if ((metadata.mode & PRIVATE_MODE_MASK) !== 0) throw new Error(`${label} must not grant group or other permissions`)
  const expectedUid = process.geteuid?.() ?? process.getuid()
  if (metadata.uid !== expectedUid && !(allowRootOwner && metadata.uid === 0)) {
    throw new Error(`${label} must be owned by the service user or root`)
  }
}

export function trustedSystemdCredentialFileMetadata(metadata) {
  return metadata.isFile()
    && metadata.uid === 0
    && [0o400, 0o440].includes(metadata.mode & 0o777)
}

export function trustedSystemdCredentialDirectoryMetadata(metadata) {
  return metadata.isDirectory()
    && metadata.uid === 0
    && (metadata.mode & 0o500) === 0o500
    && (metadata.mode & 0o027) === 0
}

async function isSystemdCredentialPath(filePath, label, allowed) {
  if (!allowed) return false
  const directory = process.env.CREDENTIALS_DIRECTORY
  if (typeof directory !== 'string' || !isAbsolute(directory) || dirname(filePath) !== directory) return false
  const resolved = await realpath(directory)
  if (resolved !== directory) throw new Error(`${label} systemd credential directory must not contain symlinks`)
  const metadata = await stat(directory)
  if (!trustedSystemdCredentialDirectoryMetadata(metadata)) {
    throw new Error(`${label} systemd credential directory is not trusted`)
  }
  return true
}

export async function readPrivateText(filePath, label, {
  minBytes = 1,
  maxBytes = 65_536,
  allowSystemdCredential = false,
} = {}) {
  if (typeof filePath !== 'string' || !isAbsolute(filePath)) throw new Error(`${label} path must be absolute`)
  const systemdCredential = await isSystemdCredentialPath(filePath, label, allowSystemdCredential)
  const handle = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
  try {
    const metadata = await handle.stat()
    assertPrivateMetadata(metadata, label, { systemdCredential })
    if (metadata.size < minBytes || metadata.size > maxBytes) throw new Error(`${label} size is outside the accepted range`)
    return await handle.readFile({ encoding: 'utf8' })
  } finally {
    await handle.close()
  }
}

export async function assertPrivateDirectory(directoryPath, label) {
  if (!isAbsolute(directoryPath)) throw new Error(`${label} path must be absolute`)
  const resolved = await realpath(directoryPath)
  if (resolved !== directoryPath) throw new Error(`${label} must not contain a symlinked final directory`)
  const metadata = await stat(directoryPath)
  if (!metadata.isDirectory()) throw new Error(`${label} must be a directory`)
  if ((metadata.mode & PRIVATE_MODE_MASK) !== 0) throw new Error(`${label} must not grant group or other permissions`)
  const expectedUid = process.geteuid?.() ?? process.getuid()
  if (metadata.uid !== expectedUid) throw new Error(`${label} must be owned by the service user`)
}

export async function writePrivateJsonExclusive(filePath, value, label) {
  if (!isAbsolute(filePath)) throw new Error(`${label} path must be absolute`)
  await assertPrivateDirectory(dirname(filePath), `${label} parent directory`)
  const serialized = `${JSON.stringify(value)}\n`
  const handle = await open(
    filePath,
    fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
    0o600,
  )
  try {
    await handle.writeFile(serialized, { encoding: 'utf8' })
    await handle.sync()
  } finally {
    await handle.close()
  }
}

export function hmacBase64Url(secret, purpose, value) {
  return createHmac('sha256', secret).update(purpose).update('\0').update(value).digest('base64url')
}

export function safeEqualString(left, right) {
  const leftDigest = createHash('sha256').update(String(left), 'utf8').digest()
  const rightDigest = createHash('sha256').update(String(right), 'utf8').digest()
  return timingSafeEqual(leftDigest, rightDigest)
}

function assertPassword(password) {
  if (typeof password !== 'string' || password.length < 1 || Buffer.byteLength(password, 'utf8') > 4096) {
    throw new Error('Password must contain between 1 and 4096 UTF-8 bytes')
  }
}

function decodeBase64Url(value, label, minBytes, maxBytes) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error(`${label} is not canonical base64url`)
  const decoded = Buffer.from(value, 'base64url')
  if (decoded.length < minBytes || decoded.length > maxBytes || decoded.toString('base64url') !== value) {
    throw new Error(`${label} length or encoding is invalid`)
  }
  return decoded
}

export function parseScryptVerifier(value) {
  if (typeof value !== 'string') throw new Error('Password verifier must be a string')
  const matched = VERIFIER_PATTERN.exec(value)
  if (!matched) throw new Error('Password verifier format is invalid')
  const N = Number(matched[1])
  const r = Number(matched[2])
  const p = Number(matched[3])
  if (!Number.isSafeInteger(N) || N < 16_384 || N > 1_048_576 || (N & (N - 1)) !== 0) {
    throw new Error('Password verifier scrypt N is invalid')
  }
  if (!Number.isSafeInteger(r) || r < 8 || r > 32 || !Number.isSafeInteger(p) || p < 1 || p > 8) {
    throw new Error('Password verifier scrypt parameters are invalid')
  }
  const salt = decodeBase64Url(matched[4], 'Password verifier salt', 16, 64)
  const digest = decodeBase64Url(matched[5], 'Password verifier digest', 32, 64)
  return { N, r, p, salt, digest }
}

export async function makeScryptVerifier(password, parameters = {}) {
  assertPassword(password)
  const N = parameters.N ?? 32_768
  const r = parameters.r ?? 8
  const p = parameters.p ?? 1
  const salt = parameters.salt ?? randomBytes(24)
  const keyLength = parameters.keyLength ?? 32
  const maxmem = Math.max(64 * 1024 * 1024, 256 * N * r)
  const digest = await scrypt(password, salt, keyLength, { N, r, p, maxmem })
  return `scrypt$${N}$${r}$${p}$${Buffer.from(salt).toString('base64url')}$${Buffer.from(digest).toString('base64url')}`
}

export async function verifyPassword(password, verifier) {
  assertPassword(password)
  const parsed = parseScryptVerifier(verifier)
  const maxmem = Math.max(64 * 1024 * 1024, 256 * parsed.N * parsed.r)
  const derived = Buffer.from(await scrypt(password, parsed.salt, parsed.digest.length, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
    maxmem,
  }))
  return timingSafeEqual(derived, parsed.digest)
}

function exactObject(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${label} contains unknown field ${key}`)
  return value
}

export function parsePasswordRecord(raw, expectedUsername) {
  let value
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error('Password verifier file must contain valid JSON')
  }
  exactObject(value, ['schema', 'username', 'verifier'], 'Password verifier record')
  if (value.schema !== PASSWORD_SCHEMA) throw new Error('Password verifier schema is invalid')
  if (typeof value.username !== 'string' || !safeEqualString(value.username, expectedUsername)) {
    throw new Error('Password verifier username does not match portal configuration')
  }
  parseScryptVerifier(value.verifier)
  return Object.freeze({ schema: PASSWORD_SCHEMA, username: value.username, verifier: value.verifier })
}

export async function readPasswordInput(filePath, expectedUsername) {
  const raw = await readPrivateText(filePath, 'Password input', { maxBytes: 8192 })
  if (raw.trimStart().startsWith('{')) {
    let value
    try {
      value = JSON.parse(raw)
    } catch {
      throw new Error('Password input JSON is invalid')
    }
    exactObject(value, ['version', 'username', 'password'], 'Password input')
    if (Object.hasOwn(value, 'version') && value.version !== 1) {
      throw new Error('Password input version is unsupported')
    }
    if (typeof value.username !== 'string' || !safeEqualString(value.username, expectedUsername)) {
      throw new Error('Password input username does not match --username')
    }
    assertPassword(value.password)
    return value.password
  }
  const password = raw.endsWith('\r\n') ? raw.slice(0, -2) : raw.endsWith('\n') ? raw.slice(0, -1) : raw
  if (password.includes('\n') || password.includes('\r')) throw new Error('Plain password input must contain exactly one line')
  assertPassword(password)
  return password
}

export function passwordRecord(username, verifier) {
  if (typeof username !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(username)) throw new Error('Username is invalid')
  parseScryptVerifier(verifier)
  return { schema: PASSWORD_SCHEMA, username, verifier }
}

export function parseCookies(header) {
  const cookies = new Map()
  if (header === undefined) return cookies
  if (typeof header !== 'string' || header.length > 8192) throw new Error('Cookie header is invalid')
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index < 1) continue
    const name = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || cookies.has(name)) throw new Error('Cookie header is invalid')
    cookies.set(name, value)
  }
  return cookies
}

export class FixedWindowRateLimiter {
  constructor({ limit, windowMs, maxEntries = 4096 }) {
    this.limit = limit
    this.windowMs = windowMs
    this.maxEntries = maxEntries
    this.entries = new Map()
  }

  consume(key, now = Date.now()) {
    let entry = this.entries.get(key)
    if (!entry || now >= entry.resetAt) {
      if (!entry && this.entries.size >= this.maxEntries) this.prune(now)
      if (!entry && this.entries.size >= this.maxEntries) return { allowed: false, retryAfterSeconds: 60 }
      entry = { count: 0, resetAt: now + this.windowMs }
      this.entries.set(key, entry)
    }
    entry.count += 1
    return {
      allowed: entry.count <= this.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    }
  }

  prune(now = Date.now()) {
    for (const [key, entry] of this.entries) if (now >= entry.resetAt) this.entries.delete(key)
  }
}

export class BoundedSemaphore {
  constructor(limit, maxQueue = 64) {
    this.limit = limit
    this.maxQueue = maxQueue
    this.active = 0
    this.queue = []
  }

  async acquire(signal) {
    if (signal?.aborted) throw new Error('UPSTREAM_ACQUIRE_ABORTED')
    if (this.active < this.limit) {
      this.active += 1
      return this.release.bind(this)
    }
    if (this.queue.length >= this.maxQueue) throw new Error('UPSTREAM_QUEUE_FULL')
    return await new Promise((resolve, reject) => {
      const queued = {
        resolve,
        reject,
        signal,
        aborted: undefined,
      }
      queued.aborted = () => {
        const index = this.queue.indexOf(queued)
        if (index < 0) return
        this.queue.splice(index, 1)
        reject(new Error('UPSTREAM_ACQUIRE_ABORTED'))
      }
      signal?.addEventListener('abort', queued.aborted, { once: true })
      this.queue.push(queued)
      if (signal?.aborted) queued.aborted()
    })
  }

  release() {
    const next = this.queue.shift()
    if (next) {
      next.signal?.removeEventListener('abort', next.aborted)
      next.resolve(this.release.bind(this))
    }
    else this.active -= 1
  }
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url')
}

export function securityHeaders({ nonce, spa = false } = {}) {
  const csp = spa
    ? "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self' data:; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob:; manifest-src 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self'"
    : `default-src 'none'; base-uri 'none'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; style-src 'nonce-${nonce}'`
  return {
    'Content-Security-Policy': csp,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  }
}
