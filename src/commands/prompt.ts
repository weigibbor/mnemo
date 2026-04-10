import { isWatcherRunning } from '../utils/pid.js'

export async function promptCommand(): Promise<void> {
  const { running } = isWatcherRunning()
  if (running) process.stdout.write('[mnemo] ')
}
