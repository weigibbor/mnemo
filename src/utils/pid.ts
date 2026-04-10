import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const MNEMO_DIR = join(homedir(), '.mnemo')
const PID_FILE = join(MNEMO_DIR, 'watcher.pid')

export function writePid(): void {
  mkdirSync(MNEMO_DIR, { recursive: true })
  writeFileSync(PID_FILE, String(process.pid))
}

export function removePid(): void {
  try { unlinkSync(PID_FILE) } catch {}
}

export function isWatcherRunning(): { running: boolean; pid: number | null } {
  if (!existsSync(PID_FILE)) return { running: false, pid: null }

  try {
    const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10)
    if (isNaN(pid)) return { running: false, pid: null }
    process.kill(pid, 0) // throws if process doesn't exist
    return { running: true, pid }
  } catch {
    // stale PID file — process is dead, clean up
    try { unlinkSync(PID_FILE) } catch {}
    return { running: false, pid: null }
  }
}
