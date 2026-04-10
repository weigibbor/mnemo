import chalk from 'chalk'
import ora from 'ora'
import { getDb, searchMemories, getRecentMemories } from '../db/store.js'
import { recallQuery } from '../core/extractor.js'
import { embed } from '../core/embeddings.js'
import { getGitContext, getProjectName } from '../core/git.js'
import { requireApiKey } from '../utils/apikey.js'
import type { Memory } from '../types.js'

const TYPE_COLOR: Record<string, (text: string) => string> = {
  decision: chalk.green,
  rejection: chalk.red,
  pattern: chalk.blue,
  reference: chalk.yellow,
  error: chalk.magenta,
}

export async function recallCommand(query: string | undefined): Promise<void> {
  const db = getDb()
  const project = getProjectName()
  const { branch } = getGitContext()

  console.log()

  if (!query) {
    const memories = getRecentMemories(db, project, branch, 15)
    printMemoryList(memories, project, branch)
    return
  }

  requireApiKey()

  const spinner = ora(chalk.dim(`searching: "${query}"...`)).start()

  let queryEmbedding: number[] | null = null
  try {
    queryEmbedding = await embed(query)
  } catch {}

  const results = searchMemories(db, query, queryEmbedding, project, branch, 10)

  if (results.length === 0) {
    spinner.warn(chalk.dim(`No memories found for "${query}"`))
    console.log(chalk.dim('\n  Start capturing: ') + chalk.white('mnemo watch'))
    console.log()
    return
  }

  spinner.text = chalk.dim('synthesizing...')
  const answer = await recallQuery(query, results)
  spinner.stop()

  console.log(chalk.cyan('  mnemo recall') + chalk.dim(` — "${query}"\n`))
  console.log('  ' + answer.split('\n').join('\n  '))
  console.log()
  console.log(
    chalk.dim(`  ${results.length} memor${results.length === 1 ? 'y' : 'ies'}`) +
    chalk.dim(` · project: ${project}`) +
    (branch ? chalk.dim(` · branch: ${branch}`) : '')
  )
  console.log()
}

function printMemoryList(memories: Memory[], project: string, branch: string | null): void {
  if (memories.length === 0) {
    console.log(chalk.dim('  No memories yet for ') + chalk.white(project))
    console.log(chalk.dim('  Start capturing:  ') + chalk.white('mnemo watch'))
    console.log()
    return
  }

  console.log(
    chalk.cyan('  mnemo') +
    chalk.dim(` · ${project}${branch ? ` · ${branch}` : ''} · ${memories.length} memories\n`)
  )

  for (const m of memories) {
    const color = TYPE_COLOR[m.type] ?? chalk.white
    const branchTag = m.branch && m.branch !== branch
      ? chalk.dim(` [${m.branch}]`)
      : ''
    console.log(
      `  ${color(`[${m.type}]`)} ${chalk.dim(`★${m.importance}`)}${branchTag}  ${m.content}`
    )
    if (m.reasoning) console.log(chalk.dim(`         → ${m.reasoning}`))
    if (m.files.length) console.log(chalk.dim(`         → ${m.files.join(', ')}`))
    console.log()
  }
}
