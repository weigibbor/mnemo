import chalk from 'chalk'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export async function initCommand(): Promise<void> {
  console.log()

  const configDir = join(process.cwd(), '.claude')
  const configFile = join(configDir, 'settings.json')

  mkdirSync(configDir, { recursive: true })

  let config: any = {}
  if (existsSync(configFile)) {
    try {
      config = JSON.parse(readFileSync(configFile, 'utf-8'))
    } catch {}
  }

  if (!config.mcpServers) config.mcpServers = {}

  config.mcpServers.mnemo = {
    command: 'npx',
    args: ['-y', 'mnemo-ai', 'mcp'],
  }

  writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n')

  console.log(chalk.cyan('  mnemo') + chalk.dim(' initialized\n'))
  console.log(chalk.dim('  MCP config written to: ') + chalk.white('.claude/settings.json'))
  console.log()
  console.log(chalk.dim('  Next steps:'))
  console.log(chalk.dim('    1. ') + chalk.white('mnemo watch') + chalk.dim('  — start capturing memories'))
  console.log(chalk.dim('    2. Use your AI coding tool — mnemo will watch and extract'))
  console.log(chalk.dim('    3. ') + chalk.white('mnemo recall') + chalk.dim(' — query your memories'))
  console.log()
  console.log(chalk.dim('  Shell prompt indicator (optional):'))
  console.log(chalk.dim('    Add this to your ~/.zshrc or ~/.bashrc:'))
  console.log()
  console.log(chalk.white("    export PS1='$(mnemo prompt)'$PS1"))
  console.log()
  console.log(chalk.dim('    Shows [mnemo] in your prompt when the watcher is active.'))
  console.log()
}
