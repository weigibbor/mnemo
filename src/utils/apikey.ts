import chalk from 'chalk'

/**
 * Validate that ANTHROPIC_API_KEY is set before any command
 * that calls the API. Exits with a friendly message if not.
 */
export function requireApiKey(): void {
  const key = process.env.ANTHROPIC_API_KEY

  if (!key || key.trim() === '') {
    console.log()
    console.log(chalk.red('  Missing ANTHROPIC_API_KEY\n'))
    console.log(chalk.dim('  mnemo uses an AI engine to extract and synthesize memories.'))
    console.log(chalk.dim('  You need an Anthropic API key to use it.\n'))
    console.log(chalk.dim('  Get one at: ') + chalk.white('https://console.anthropic.com'))
    console.log()
    console.log(chalk.dim('  Then set it:'))
    console.log(chalk.dim('    export ANTHROPIC_API_KEY=sk-ant-...'))
    console.log()
    console.log(chalk.dim('  Or add it to your shell profile (~/.zshrc, ~/.bashrc):'))
    console.log(chalk.dim('    echo \'export ANTHROPIC_API_KEY=sk-ant-...\' >> ~/.zshrc'))
    console.log()
    console.log(chalk.dim('  Free tier is enough — typical session uses < $0.01.'))
    console.log()
    process.exit(1)
  }

  if (!key.startsWith('sk-ant-')) {
    console.log()
    console.log(chalk.yellow('  Warning: ANTHROPIC_API_KEY looks unexpected'))
    console.log(chalk.dim('  Expected format: sk-ant-...'))
    console.log(chalk.dim('  Get yours at: https://console.anthropic.com'))
    console.log()
  }
}
