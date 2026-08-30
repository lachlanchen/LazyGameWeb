#!/usr/bin/env node

import { runCli } from '../src/cli.mjs'

runCli(process.argv.slice(2)).catch((error) => {
  const message = error instanceof Error ? error.message : 'Unexpected portal failure'
  process.stderr.write(`game-portal: ${message}\n`)
  process.exitCode = 1
})
