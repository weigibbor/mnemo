import chalk from 'chalk'
import { getDb, deleteMemory } from '../db/store.js'

export async function forgetCommand(id: string): Promise<void> {
  const db = getDb()
  const numId = parseInt(id, 10)

  if (isNaN(numId)) {
    console.log()
    console.log(chalk.red(`  Invalid memory ID: "${id}"`))
    console.log(chalk.dim('  Use a numeric ID from ') + chalk.white('mnemo recall'))
    console.log()
    return
  }

  const deleted = deleteMemory(db, numId)

  console.log()
  if (deleted) {
    console.log(chalk.cyan('  mnemo') + chalk.dim(` forgot memory #${numId}`))
  } else {
    console.log(chalk.yellow(`  Memory #${numId} not found`))
  }
  console.log()
}
