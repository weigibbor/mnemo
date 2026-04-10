import chalk from 'chalk'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const LOG_FILE = join(homedir(), '.mnemo', 'mnemo.log')

export async function logsCommand(): Promise<void> {
  console.log()

  if (!existsSync(LOG_FILE)) {
    console.log(chalk.dim('  No logs yet. Run ') + chalk.white('mnemo watch') + chalk.dim(' to start.'))
    console.log()
    return
  }

  const lines = readFileSync(LOG_FILE, 'utf-8').trim().split('\n')
  const recent = lines.slice(-50)

  for (const line of recent) {
    if (line.includes('ERROR')) {
      console.log(chalk.red('  ' + line))
    } else if (line.includes('WARN')) {
      console.log(chalk.yellow('  ' + line))
    } else {
      console.log(chalk.dim('  ' + line))
    }
  }

  console.log()
  console.log(chalk.dim(`  ${LOG_FILE}`))
  console.log()
}
