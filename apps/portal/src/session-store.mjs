import { constants as fsConstants } from 'node:fs'
import { chmod, open, rename, unlink } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import {
  assertPrivateDirectory,
  hmacBase64Url,
  parseCookies,
  randomToken,
  readPrivateText,
  safeEqualString,
} from './security.mjs'

export const SESSION_COOKIE = '__Host-game_session'
export const LOGIN_COOKIE = '__Host-game_login'
const STORE_SCHEMA = 'lazyingart.game-portal.sessions.v1'
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${label} contains unknown field ${key}`)
  return value
}

function cookie(name, value, { maxAge } = {}) {
  const attributes = [`${name}=${value}`, 'Path=/', 'Secure', 'HttpOnly', 'SameSite=Strict', 'Priority=High']
  if (maxAge !== undefined) attributes.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`)
  return attributes.join('; ')
}

export function clearSessionCookies() {
  return [cookie(SESSION_COOKIE, '', { maxAge: 0 }), cookie(LOGIN_COOKIE, '', { maxAge: 0 })]
}

export class SessionRegistry {
  constructor({ secret, storeFile, username, sessionHours, rememberDays, maxRememberedSessions }) {
    this.secret = secret
    this.storeFile = storeFile
    this.username = username
    this.sessionMilliseconds = sessionHours * 60 * 60 * 1000
    this.rememberMilliseconds = rememberDays * 24 * 60 * 60 * 1000
    this.maxRememberedSessions = maxRememberedSessions
    this.maxMemorySessions = Math.max(32, maxRememberedSessions)
    this.remembered = new Map()
    this.memory = new Map()
    this.revision = 0
    this.writeChain = Promise.resolve()
  }

  async init(now = Date.now()) {
    await assertPrivateDirectory(dirname(this.storeFile), 'Session store directory')
    let raw
    try {
      raw = await readPrivateText(this.storeFile, 'Session store', { maxBytes: 1_048_576 })
    } catch (error) {
      if (error && typeof error === 'object' && error.code === 'ENOENT') return this
      throw error
    }
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error('Session store JSON is invalid')
    }
    exactKeys(parsed, ['schema', 'revision', 'sessions'], 'Session store')
    if (parsed.schema !== STORE_SCHEMA || !Number.isSafeInteger(parsed.revision) || parsed.revision < 0 || !Array.isArray(parsed.sessions)) {
      throw new Error('Session store schema is invalid')
    }
    if (parsed.sessions.length > this.maxRememberedSessions) throw new Error('Session store exceeds the configured session bound')
    this.revision = parsed.revision
    let pruned = false
    for (const untrusted of parsed.sessions) {
      exactKeys(untrusted, ['sessionHash', 'username', 'createdAt', 'expiresAt'], 'Remembered session')
      if (!SIGNATURE_PATTERN.test(untrusted.sessionHash) || untrusted.username !== this.username) throw new Error('Remembered session identity is invalid')
      if (!Number.isSafeInteger(untrusted.createdAt) || !Number.isSafeInteger(untrusted.expiresAt) || untrusted.createdAt < 0 || untrusted.expiresAt <= untrusted.createdAt) {
        throw new Error('Remembered session timestamps are invalid')
      }
      if (untrusted.expiresAt <= now) {
        pruned = true
        continue
      }
      if (this.remembered.has(untrusted.sessionHash)) throw new Error('Session store contains a duplicate session')
      this.remembered.set(untrusted.sessionHash, Object.freeze({ ...untrusted }))
    }
    if (pruned) await this.persist()
    return this
  }

  sessionHash(id) {
    return hmacBase64Url(this.secret, 'session-store', id)
  }

  sessionSignature(id, expiresAt, remembered) {
    return hmacBase64Url(this.secret, 'session-cookie', `${id}.${expiresAt}.${remembered ? 1 : 0}.${this.username}`)
  }

  csrfToken(id, expiresAt) {
    return hmacBase64Url(this.secret, 'session-csrf', `${id}.${expiresAt}.${this.username}`)
  }

  newLoginChallenge(now = Date.now()) {
    const id = randomToken()
    const expiresAt = now + 10 * 60 * 1000
    const signature = hmacBase64Url(this.secret, 'login-csrf', `${id}.${expiresAt}`)
    const value = `v1.${id}.${expiresAt}.${signature}`
    return { value, cookie: cookie(LOGIN_COOKIE, value, { maxAge: 600 }) }
  }

  verifyLoginChallenge(cookieValue, submittedValue, now = Date.now()) {
    if (typeof cookieValue !== 'string' || typeof submittedValue !== 'string' || !safeEqualString(cookieValue, submittedValue)) return false
    const parts = cookieValue.split('.')
    if (parts.length !== 4 || parts[0] !== 'v1' || !SESSION_ID_PATTERN.test(parts[1]) || !/^\d{13}$/.test(parts[2]) || !SIGNATURE_PATTERN.test(parts[3])) return false
    const expiresAt = Number(parts[2])
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + 11 * 60 * 1000) return false
    const expected = hmacBase64Url(this.secret, 'login-csrf', `${parts[1]}.${expiresAt}`)
    return safeEqualString(expected, parts[3])
  }

  async create({ remember }, now = Date.now()) {
    this.prune(now)
    const id = randomToken()
    const remembered = Boolean(remember)
    const expiresAt = now + (remembered ? this.rememberMilliseconds : this.sessionMilliseconds)
    const sessionHash = this.sessionHash(id)
    const record = Object.freeze({ sessionHash, username: this.username, createdAt: now, expiresAt })
    if (remembered) {
      if (this.remembered.size >= this.maxRememberedSessions) throw new Error('REMEMBERED_SESSION_LIMIT')
      this.remembered.set(sessionHash, record)
      try {
        await this.persist()
      } catch (error) {
        this.remembered.delete(sessionHash)
        throw error
      }
    } else {
      if (this.memory.size >= this.maxMemorySessions) {
        const oldest = [...this.memory.values()].sort((a, b) => a.createdAt - b.createdAt)[0]
        if (oldest) this.memory.delete(oldest.sessionHash)
      }
      this.memory.set(sessionHash, record)
    }
    const signature = this.sessionSignature(id, expiresAt, remembered)
    const value = `v1.${id}.${expiresAt}.${remembered ? 1 : 0}.${signature}`
    return {
      cookie: cookie(SESSION_COOKIE, value, remembered ? { maxAge: Math.floor(this.rememberMilliseconds / 1000) } : {}),
      csrfToken: this.csrfToken(id, expiresAt),
      expiresAt,
      remembered,
      token: value,
    }
  }

  authenticate(cookieHeader, now = Date.now()) {
    let value
    try {
      value = parseCookies(cookieHeader).get(SESSION_COOKIE)
    } catch {
      return null
    }
    if (!value) return null
    const parts = value.split('.')
    if (parts.length !== 5 || parts[0] !== 'v1' || !SESSION_ID_PATTERN.test(parts[1]) || !/^\d{13}$/.test(parts[2]) || !/^[01]$/.test(parts[3]) || !SIGNATURE_PATTERN.test(parts[4])) return null
    const expiresAt = Number(parts[2])
    const remembered = parts[3] === '1'
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return null
    const expectedSignature = this.sessionSignature(parts[1], expiresAt, remembered)
    if (!safeEqualString(expectedSignature, parts[4])) return null
    const sessionHash = this.sessionHash(parts[1])
    const record = (remembered ? this.remembered : this.memory).get(sessionHash)
    if (!record || record.expiresAt !== expiresAt || record.username !== this.username) return null
    return Object.freeze({
      sessionHash,
      username: this.username,
      expiresAt,
      remembered,
      csrfToken: this.csrfToken(parts[1], expiresAt),
    })
  }

  verifyCsrf(session, supplied) {
    return Boolean(session && typeof supplied === 'string' && safeEqualString(session.csrfToken, supplied))
  }

  async revoke(session) {
    if (!session) return
    if (session.remembered) {
      const removed = this.remembered.delete(session.sessionHash)
      if (removed) await this.persist()
    } else this.memory.delete(session.sessionHash)
  }

  prune(now = Date.now()) {
    for (const [key, record] of this.memory) if (record.expiresAt <= now) this.memory.delete(key)
    for (const [key, record] of this.remembered) if (record.expiresAt <= now) this.remembered.delete(key)
  }

  serialized() {
    return {
      schema: STORE_SCHEMA,
      revision: this.revision + 1,
      sessions: [...this.remembered.values()].sort((a, b) => a.createdAt - b.createdAt),
    }
  }

  async persist() {
    this.writeChain = this.writeChain.catch(() => {}).then(async () => {
      const value = this.serialized()
      const directory = dirname(this.storeFile)
      const temporary = `${directory}/.${basename(this.storeFile)}.${process.pid}.${randomToken(8)}.tmp`
      const handle = await open(
        temporary,
        fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
        0o600,
      )
      let renamed = false
      try {
        await handle.writeFile(`${JSON.stringify(value)}\n`, { encoding: 'utf8' })
        await handle.sync()
        await handle.close()
        await rename(temporary, this.storeFile)
        renamed = true
        await chmod(this.storeFile, 0o600)
        const directoryHandle = await open(directory, fsConstants.O_RDONLY)
        try {
          await directoryHandle.sync()
        } finally {
          await directoryHandle.close()
        }
        this.revision = value.revision
      } finally {
        try {
          await handle.close()
        } catch {}
        if (!renamed) {
          try {
            await unlink(temporary)
          } catch (error) {
            if (!error || typeof error !== 'object' || error.code !== 'ENOENT') throw error
          }
        }
      }
    })
    return await this.writeChain
  }
}
