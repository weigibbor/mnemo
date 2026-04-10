import { execSync } from 'child_process'

export interface GitContext {
  branch: string | null
  recentCommits: string[]
  changedFiles: string[]
  repoRoot: string | null
}

export function getGitContext(cwd = process.cwd()): GitContext {
  const run = (cmd: string): string => {
    try {
      return execSync(cmd, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
        .toString()
        .trim()
    } catch {
      return ''
    }
  }

  const branch = run('git branch --show-current') || null
  const repoRoot = run('git rev-parse --show-toplevel') || null
  const recentCommits = run('git log --oneline -10').split('\n').filter(Boolean)
  const changedFiles = run('git diff --name-only HEAD').split('\n').filter(Boolean)

  return { branch, recentCommits, changedFiles, repoRoot }
}

export function getProjectName(cwd = process.cwd()): string {
  const { repoRoot } = getGitContext(cwd)
  if (repoRoot) {
    return repoRoot.split('/').pop() ?? 'unknown'
  }
  return cwd.split('/').pop() ?? 'unknown'
}
