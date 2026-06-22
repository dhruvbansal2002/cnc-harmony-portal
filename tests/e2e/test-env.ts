import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function parseDotenvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return new Map<string, string>()
  }

  const entries = new Map<string, string>()
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const equalsIndex = trimmed.indexOf('=')

    if (equalsIndex <= 0) {
      continue
    }

    const key = trimmed.slice(0, equalsIndex).trim()
    const value = trimmed.slice(equalsIndex + 1).trim()

    if (!key) {
      continue
    }

    entries.set(key, value)
  }

  return entries
}

const dotenvValues = parseDotenvFile(resolve(process.cwd(), '.env.local'))

export function getTestEnv(name: string) {
  const value = process.env[name] ?? dotenvValues.get(name)

  if (!value) {
    throw new Error(`Missing required test environment variable: ${name}`)
  }

  return value
}

