import chalk from 'chalk'
import ora from 'ora'
import { getDb } from '../db/store.js'
import { SessionWatcher } from '../core/watcher.js'
import { requireApiKey } from '../utils/apikey.js'

export async function watchCommand(): Promise<void> {
  requireApiKey()

  const db = getDb()
  const watcher = new SessionWatcher(db)

  const project = watcher.getProject()
  const branch  = watcher.getBranch()

  console.log()
  const spinner = ora({
    text: chalk.dim(`watching ${chalk.white(project)}${branch ? chalk.dim(`  branch: ${branch}`) : ''}...`),
    spinner: 'dots',
    color: 'cyan',
  }).start()

  watcher.start()

  spinner.succeed(
    chalk.cyan('mnemo') + chalk.dim(' is watching\n') +
    chalk.dim('  project : ') + chalk.white(project) + '\n' +
    (branch ? chalk.dim('  branch  : ') + chalk.white(branch) + '\n' : '') +
    chalk.dim('  sources : AI session files\n') +
    chalk.dim('  flushes every 30s of session inactivity\n') +
    chalk.dim('  press Ctrl+C to stop\n')
  )

  process.on('SIGINT', async () => {
    console.log()
    const s = ora('Extracting final memories...').start()
    await watcher.stop()
    const n = watcher.getCount()
    s.succeed(
      chalk.cyan('mnemo') +
      chalk.dim(` captured ${chalk.white(n)} memor${n === 1 ? 'y' : 'ies'} this session`)
    )
    if (n > 0) {
      console.log(chalk.dim(`\n  Run: `) + chalk.white(`mnemo recall`) + chalk.dim(' to query them'))
    }
    console.log()
    process.exit(0)
  })

  setInterval(() => {}, 1000)
}
