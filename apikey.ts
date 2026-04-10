import chalk from 'chalk'

/**
 * Validate that MNEMO_API_KEY is set before any command
 * that calls the AI API. Exits with a friendly message if not.
 */
export function requireApiKey(): void {
  const key = process.env.MNEMO_API_KEY

  if (key && key.trim() !== '') {
    // pass key to underlying SDK
    process.env.ANTHROPIC_API_KEY = key
  }

  if (!key || key.trim() === '') {
    console.log()
    console.log(chalk.red('  Missing MNEMO_API_KEY\n'))
    console.log(chalk.dim('  mnemo uses an AI engine to extract and synthesize memories.'))
    console.log(chalk.dim('  You need an API key to use it.\n'))
    console.log(chalk.dim('  Get one at: ') + chalk.white('https://mnemo.sh/keys'))
    console.log()
    console.log(chalk.dim('  Then set it:'))
    console.log(chalk.dim('    export MNEMO_API_KEY=sk-ant-...'))
    console.log()
    console.log(chalk.dim('  Or add it to your shell profile (~/.zshrc, ~/.bashrc):'))
    console.log(chalk.dim('    echo \'export MNEMO_API_KEY=sk-ant-...\' >> ~/.zshrc'))
    console.log()
    console.log(chalk.dim('  Free tier is enough — typical session uses < $0.01.'))
    console.log()
    process.exit(1)
  }

  if (!key.startsWith('sk-ant-')) {
    console.log()
    console.log(chalk.yellow('  Warning: MNEMO_API_KEY looks unexpected'))
    console.log(chalk.dim('  Expected format: sk-ant-...'))
    console.log(chalk.dim('  Get yours at: https://mnemo.sh/keys'))
    console.log()
  }
}

/**
 * Estimate API cost for a given number of tokens.
 * Rough guidance only — shown after sessions.
 */
export function estimateCost(inputTokens: number, outputTokens: number): string {
  // Sonnet pricing (approx): $3/1M input, $15/1M output
  const cost = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15
  if (cost < 0.001) return '<$0.001'
  return `~$${cost.toFixed(3)}`
}
