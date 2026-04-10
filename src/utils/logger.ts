import { appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const MNEMO_DIR = join(homedir(), '.mnemo')
const LOG_FILE = join(MNEMO_DIR, 'mnemo.log')

export function log(level: 'info' | 'warn' | 'error', message: string): void {
  try {
    mkdirSync(MNEMO_DIR, { recursive: true })
    const ts = new Date().toISOString()
    appendFileSync(LOG_FILE, `[${ts}] ${level.toUpperCase()} ${message}\n`)
  } catch {}
}
