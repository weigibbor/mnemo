import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { getDb, getRecentMemories, searchMemories, saveMemory, getStats } from '../db/store.js'
import { embed } from '../core/embeddings.js'
import { getGitContext, getProjectName } from '../core/git.js'
import { isWatcherRunning } from '../utils/pid.js'
import { randomUUID } from 'crypto'

export async function startMcpServer(): Promise<void> {
  const db = getDb()
  const project = getProjectName()
  const { branch } = getGitContext()

  const server = new Server(
    { name: 'mnemo', version: '0.2.2' },
    { capabilities: { tools: {} } }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'mnemo_context',
        description:
          'Load persistent memory context for the current project. ' +
          'Call at session start to restore decisions, patterns, and references from past sessions. ' +
          'Returns branch-aware, importance-ranked memories.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            query: {
              type: 'string',
              description: 'Optional topic to focus recall. Omit for full project context.',
            },
          },
        },
      },
      {
        name: 'mnemo_save',
        description:
          'Save a decision, pattern, rejection, or reference to persistent memory. ' +
          'Use when the developer explicitly makes an architectural choice, finds a pattern, or discovers a root cause.',
        inputSchema: {
          type: 'object' as const,
          required: ['type', 'content'],
          properties: {
            type: { type: 'string', enum: ['decision', 'rejection', 'pattern', 'reference', 'error'] },
            content: { type: 'string', description: 'The memory to persist' },
            reasoning: { type: 'string', description: 'Why this matters' },
            files: { type: 'array', items: { type: 'string' }, description: 'Related file paths' },
            tags: { type: 'array', items: { type: 'string' } },
            importance: { type: 'number', description: '1-10' },
          },
        },
      },
    ],
  }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params

    if (name === 'mnemo_context') {
      const query = (args as any)?.query as string | undefined

      let memories
      if (query) {
        let qEmbed: number[] | null = null
        try { qEmbed = await embed(query) } catch {}
        memories = searchMemories(db, query, qEmbed, project, branch, 15)
      } else {
        memories = getRecentMemories(db, project, branch, 20)
      }

      if (memories.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `No mnemo memories found for "${project}"${branch ? ` on branch ${branch}` : ''}. Run \`mnemo watch\` to start capturing.`,
          }],
        }
      }

      const watcher = isWatcherRunning()
      const stats = getStats(db, project)
      const lastAgo = stats.lastCaptured
        ? timeAgo(new Date(stats.lastCaptured))
        : 'never'

      const statusLine = `[mnemo] ${watcher.running ? 'watching' : 'inactive'} | ${stats.total} memories | branch: ${branch ?? 'unknown'} | last: ${lastAgo}`

      const formatted = [
        statusLine + '\n',
        `mnemo context: ${project}${branch ? ` (${branch})` : ''} — ${memories.length} memories\n`,
        ...memories.map((m) => {
          const lines = [`[${m.type.toUpperCase()}] ★${m.importance}  ${m.content}`]
          if (m.reasoning) lines.push(`  → ${m.reasoning}`)
          if (m.files?.length) lines.push(`  → files: ${m.files.join(', ')}`)
          return lines.join('\n')
        }),
      ].join('\n')

      return { content: [{ type: 'text' as const, text: formatted }] }
    }

    if (name === 'mnemo_save') {
      const a = args as any
      const sessionId = `mcp-${randomUUID()}`

      try {
        db.prepare(
          'INSERT OR IGNORE INTO sessions (id, project, branch, started_at) VALUES (?, ?, ?, datetime("now"))'
        ).run(sessionId, project, branch)
      } catch {}

      const id = saveMemory(db, {
        type: a.type,
        content: a.content,
        reasoning: a.reasoning ?? null,
        project,
        branch,
        files: a.files ?? [],
        tags: a.tags ?? [],
        importance: Math.min(10, Math.max(1, a.importance ?? 7)),
        sessionId,
      })

      embed(`${a.content} ${a.reasoning ?? ''}`).then((vec) => {
        try {
          db.prepare('UPDATE memories SET embedding = ? WHERE id = ?').run(JSON.stringify(vec), id)
        } catch {}
      }).catch(() => {})

      return { content: [{ type: 'text' as const, text: `mnemo saved [${a.type}]: ${a.content}` }] }
    }

    throw new Error(`Unknown tool: ${name}`)
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

function timeAgo(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
