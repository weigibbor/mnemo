import chalk from 'chalk'
import { getDb, getStats } from '../db/store.js'
import { getGitContext, getProjectName } from '../core/git.js'

export async function statusCommand(): Promise<void> {
  const db = getDb()
  const project = getProjectName()
  const { branch } = getGitContext()

  const stats = getStats(db, project)

  console.log()
  console.log(chalk.cyan('  mnemo status') + chalk.dim(` · ${project}\n`))

  if (stats.total === 0) {
    console.log(chalk.dim('  No memories captured yet.'))
    console.log(chalk.dim('  Run: ') + chalk.white('mnemo watch') + chalk.dim(' to start capturing'))
    console.log()
    return
  }

  console.log(chalk.dim('  memories    : ') + chalk.white(String(stats.total)))
  console.log(chalk.dim('  sessions    : ') + chalk.white(String(stats.sessions)))

  if (branch) {
    console.log(chalk.dim('  branch      : ') + chalk.white(branch))
  }

  if (stats.branches.length > 0) {
    console.log(chalk.dim('  branches    : ') + chalk.white(stats.branches.join(', ')))
  }

  if (stats.lastCaptured) {
    console.log(chalk.dim('  last capture: ') + chalk.white(stats.lastCaptured))
  }

  console.log()
  console.log(chalk.dim('  by type:'))

  const typeColors: Record<string, (text: string) => string> = {
    decision: chalk.green,
    rejection: chalk.red,
    pattern: chalk.blue,
    reference: chalk.yellow,
    error: chalk.magenta,
  }

  for (const [type, count] of Object.entries(stats.byType)) {
    const color = typeColors[type] ?? chalk.white
    console.log(`    ${color(type.padEnd(12))} ${chalk.white(String(count))}`)
  }

  console.log()
}
