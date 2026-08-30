import { isAbsolute } from 'node:path'
import { loadConfig, loadCredentials } from './config.mjs'
import {
  makeScryptVerifier,
  passwordRecord,
  readPasswordInput,
  writePrivateJsonExclusive,
} from './security.mjs'
import { createPortalServer } from './server.mjs'
import { SessionRegistry } from './session-store.mjs'

function usage() {
  return `Usage:
  game-portal serve --config ABSOLUTE_PATH
  game-portal hash-password --password-file ABSOLUTE_PATH --out ABSOLUTE_PATH --username NAME

Password material is read only from the protected input file. It is never accepted in argv or printed.`
}

function options(argv, allowed) {
  const parsed = {}
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!flag?.startsWith('--') || value === undefined || value.startsWith('--')) throw new Error(usage())
    const name = flag.slice(2)
    if (!allowed.includes(name) || Object.hasOwn(parsed, name)) throw new Error(`Unknown or duplicate option ${flag}\n${usage()}`)
    parsed[name] = value
  }
  return parsed
}

function absolute(value, label) {
  if (typeof value !== 'string' || !isAbsolute(value)) throw new Error(`${label} must be an absolute path`)
  return value
}

async function hashPassword(argv) {
  const parsed = options(argv, ['password-file', 'out', 'username'])
  const passwordFile = absolute(parsed['password-file'], '--password-file')
  const outputFile = absolute(parsed.out, '--out')
  const username = parsed.username
  if (typeof username !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(username)) throw new Error('--username is invalid')
  const password = await readPasswordInput(passwordFile, username)
  const verifier = await makeScryptVerifier(password)
  await writePrivateJsonExclusive(outputFile, passwordRecord(username, verifier), 'Password verifier output')
  process.stdout.write(`password-verifier-created path=${outputFile} username=${username}\n`)
}

async function serve(argv) {
  const parsed = options(argv, ['config'])
  const config = await loadConfig(absolute(parsed.config, '--config'))
  const credentials = await loadCredentials(config)
  const sessions = await new SessionRegistry({
    secret: credentials.sessionSecret,
    storeFile: config.auth.sessionStoreFile,
    username: config.username,
    sessionHours: config.auth.sessionHours,
    rememberDays: config.auth.rememberDays,
    maxRememberedSessions: config.auth.maxRememberedSessions,
  }).init()
  const server = createPortalServer({ config, credentials, sessions })
  await new Promise((resolve, reject) => {
    const failed = (error) => reject(error)
    server.once('error', failed)
    server.listen(config.listen.port, config.listen.host, () => {
      server.removeListener('error', failed)
      resolve()
    })
  })
  process.stdout.write(`game-portal-ready listen=${config.listen.host}:${config.listen.port} release=${config.releaseId}\n`)
  const close = (signal) => {
    process.stdout.write(`game-portal-stopping signal=${signal}\n`)
    server.close(() => process.exit(0))
    const timer = setTimeout(() => {
      server.closeAllConnections()
      process.exit(1)
    }, 10_000)
    timer.unref()
  }
  process.once('SIGTERM', () => close('SIGTERM'))
  process.once('SIGINT', () => close('SIGINT'))
}

export async function runCli(argv) {
  const [command, ...rest] = argv
  if (command === 'serve') return await serve(rest)
  if (command === 'hash-password') return await hashPassword(rest)
  if (command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(`${usage()}\n`)
    return
  }
  throw new Error(usage())
}
