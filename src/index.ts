#!/usr/bin/env node
import { Command } from 'commander'
import chalk from 'chalk'
import { watchCommand } from './commands/watch.js'
import { recallCommand } from './commands/recall.js'
import { statusCommand } from './commands/status.js'
import { forgetCommand } from './commands/forget.js'
import { initCommand } from './commands/init.js'
import { promptCommand } from './commands/prompt.js'
import { logsCommand } from './commands/logs.js'
import { startMcpServer } from './mcp/server.js'

const program = new Command()

console.log()

program
  .name('mnemo')
  .description(chalk.cyan('mnemo') + chalk.dim(' — persistent memory for AI coding tools'))
  .version('0.2.8')

program
  .command('init')
  .description('set up mnemo + MCP for this project')
  .action(initCommand)

program
  .command('watch')
  .description('start watching AI sessions and capturing memories')
  .action(watchCommand)

program
  .command('recall [query]')
  .description('recall memories, optionally by query')
  .action(recallCommand)

program
  .command('status')
  .description('show memory stats for this project')
  .action(statusCommand)

program
  .command('forget <id>')
  .description('delete a memory by ID')
  .action(forgetCommand)

program
  .command('prompt')
  .description('output shell prompt indicator (for PS1 integration)')
  .action(promptCommand)

program
  .command('logs')
  .description('show recent mnemo log output')
  .action(logsCommand)

program
  .command('mcp')
  .description('start MCP server (used by AI tools)')
  .action(async () => {
    await startMcpServer()
  })

program.parse()
