import chokidar from 'chokidar'
import { join } from 'path'
import { homedir } from 'os'
import { readFileSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3'
import { createSession, endSession, saveMemory, updateEmbedding } from '../db/store.js'
import { extractMemories } from './extractor.js'
import { embed } from './embeddings.js'
import { getGitContext, getProjectName } from './git.js'

const AI_SESSION_DIR = join(homedir(), '.claude', 'projects')
const CURSOR_LOG_DIR = join(homedir(), '.cursor', 'logs')

export class SessionWatcher {
  private db: Database.Database
  private project: string
  private sessionId: string
  private watcher: ReturnType<typeof chokidar.watch> | null = null
  private buffer: string[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private memoriesExtracted = 0
  private branch: string | null = null

  constructor(db: Database.Database) {
    this.db = db
    this.project = getProjectName()
    this.sessionId = randomUUID()
    const ctx = getGitContext()
    this.branch = ctx.branch
  }

  start(): void {
    createSession(this.db, {
      id: this.sessionId,
      project: this.project,
      branch: this.branch,
      startedAt: new Date().toISOString(),
    })

    const paths = this.resolvePaths()

    this.watcher = chokidar.watch(
      paths.length ? paths : [join(process.cwd(), '**/*.jsonl')],
      { persistent: true, ignoreInitial: true, usePolling: false }
    )

    this.watcher.on('change', (p: string) => this.onFileChange(p))
    this.watcher.on('add', (p: string) => this.onFileChange(p))
  }

  async stop(): Promise<void> {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    await this.flush()
    if (this.watcher) await this.watcher.close()
    endSession(this.db, this.sessionId, this.memoriesExtracted)
  }

  getProject(): string { return this.project }
  getBranch(): string | null { return this.branch }
  getSessionId(): string { return this.sessionId }
  getCount(): number { return this.memoriesExtracted }

  private onFileChange(filePath: string): void {
    if (!filePath.endsWith('.jsonl') && !filePath.endsWith('.log')) return
    try {
      const text = this.parseFile(filePath)
      if (text) this.buffer.push(text)
    } catch {}
    this.scheduleFlush()
  }

  private scheduleFlush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => this.flush(), 30_000)
  }

  async flush(): Promise<void> {
    if (!this.buffer.length) return
    const transcript = this.buffer.splice(0).join('\n')

    this.branch = getGitContext().branch

    const extracted = await extractMemories(transcript, this.project, this.branch)

    for (const memory of extracted) {
      const id = saveMemory(this.db, {
        ...memory,
        project: this.project,
        branch: this.branch,
        sessionId: this.sessionId,
      })

      embed(`${memory.content} ${memory.reasoning ?? ''} ${memory.tags.join(' ')}`)
        .then((vec) => updateEmbedding(this.db, id, vec))
        .catch(() => {})

      this.memoriesExtracted++
    }
  }

  private parseFile(filePath: string): string {
    const raw = readFileSync(filePath, 'utf-8')
    const texts: string[] = []

    for (const line of raw.split('\n').filter(Boolean)) {
      try {
        const obj = JSON.parse(line)
        if (obj.type === 'assistant') {
          for (const block of (obj.message?.content ?? [])) {
            if (block.type === 'text') texts.push(`AI: ${block.text}`)
          }
        }
        if (obj.type === 'user') {
          const c = obj.message?.content
          const text = Array.isArray(c)
            ? c.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' ')
            : c
          if (text) texts.push(`USER: ${text}`)
        }
      } catch {
        if (line.length > 20) texts.push(line)
      }
    }

    return texts.join('\n')
  }

  private resolvePaths(): string[] {
    const paths: string[] = []
    const slug = this.project.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    const aiPath = join(AI_SESSION_DIR, slug)
    if (existsSync(aiPath)) paths.push(join(aiPath, '**/*.jsonl'))
    if (existsSync(CURSOR_LOG_DIR)) paths.push(join(CURSOR_LOG_DIR, '**/*.log'))
    return paths
  }
}
