import chokidar from 'chokidar'
import { join } from 'path'
import { homedir } from 'os'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3'
import { createSession, endSession, saveMemory, updateEmbedding } from '../db/store.js'
import { extractMemories } from './extractor.js'
import { embed } from './embeddings.js'
import { getGitContext, getProjectName } from './git.js'
import { writePid, removePid } from '../utils/pid.js'
import { log } from '../utils/logger.js'

const AI_SESSION_DIR = join(homedir(), '.claude', 'projects')
const CURSOR_SESSION_DIR = join(homedir(), '.cursor', 'projects')
const CODEX_SESSION_DIR = join(homedir(), '.codex', 'sessions')

export class SessionWatcher {
  private db: Database.Database
  private project: string
  private sessionId: string
  private watcher: ReturnType<typeof chokidar.watch> | null = null
  private buffer: string[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private maxFlushTimer: ReturnType<typeof setInterval> | null = null
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
      paths.length ? paths : [process.cwd()],
      { persistent: true, ignoreInitial: true, usePolling: false }
    )

    this.watcher.on('change', (p: string) => this.onFileChange(p))
    this.watcher.on('add', (p: string) => this.onFileChange(p))

    log('info', `watcher started — project: ${this.project}, branch: ${this.branch}`)
    log('info', `watching paths: ${paths.length ? paths.join(', ') : 'fallback: ' + join(process.cwd(), '**/*.jsonl')}`)

    writePid()

    // Safety net: flush every 5 minutes even during continuous activity
    this.maxFlushTimer = setInterval(() => this.flush(), 5 * 60 * 1000)
  }

  async stop(): Promise<void> {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    if (this.maxFlushTimer) clearInterval(this.maxFlushTimer)
    await this.flush()
    if (this.watcher) await this.watcher.close()
    removePid()
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
    } catch (err) {
      log('warn', `parse failed for ${filePath}: ${err instanceof Error ? err.message : String(err)}`)
    }
    this.scheduleFlush()
  }

  private scheduleFlush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => this.flush(), 30_000)
  }

  async flush(): Promise<void> {
    if (!this.buffer.length) return
    const transcript = this.buffer.splice(0).join('\n')
    log('info', `flushing ${transcript.length} chars of buffered content`)

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
        .catch((err) => log('warn', `embed failed for memory ${id}: ${err instanceof Error ? err.message : String(err)}`))

      this.memoriesExtracted++
    }
  }

  private parseFile(filePath: string): string {
    const raw = readFileSync(filePath, 'utf-8')
    const texts: string[] = []

    for (const line of raw.split('\n').filter(Boolean)) {
      try {
        const obj = JSON.parse(line)

        // Codex CLI: type=response_item, role in payload
        if (obj.type === 'response_item' && obj.payload?.role) {
          const role = obj.payload.role
          for (const block of (obj.payload.content ?? [])) {
            const t = block.text ?? ''
            if (!t) continue
            if (role === 'assistant') texts.push(`AI: ${t}`)
            else if (role === 'user') texts.push(`USER: ${t}`)
          }
          continue
        }

        // Claude uses obj.type, Cursor uses obj.role
        if (obj.type === 'assistant' || obj.role === 'assistant') {
          for (const block of (obj.message?.content ?? [])) {
            if (block.type === 'text') texts.push(`AI: ${block.text}`)
          }
        }
        if (obj.type === 'user' || obj.role === 'user') {
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

    // Watch DIRECTORIES, not globs — chokidar globs fail silently on macOS
    // onFileChange() already filters for .jsonl/.log extensions

    // Claude replaces all non-alphanumeric chars with -: /Users/me/Orva_MVP → -Users-me-Orva-MVP
    const cwdSlug = process.cwd().replace(/[^a-zA-Z0-9]/g, '-')
    const cwdPath = join(AI_SESSION_DIR, cwdSlug)
    if (existsSync(cwdPath)) paths.push(cwdPath)

    // Also check all project dirs that end with the project name
    if (existsSync(AI_SESSION_DIR)) {
      try {
        for (const dir of readdirSync(AI_SESSION_DIR)) {
          if (dir === cwdSlug) continue
          if (dir.endsWith(`-${this.project}`)) {
            paths.push(join(AI_SESSION_DIR, dir))
          }
        }
      } catch {}
    }

    // Cursor: same slug but NO leading dash, transcripts in agent-transcripts/
    const cursorSlug = cwdSlug.replace(/^-/, '')
    const cursorPath = join(CURSOR_SESSION_DIR, cursorSlug, 'agent-transcripts')
    if (existsSync(cursorPath)) paths.push(cursorPath)

    // Also check Cursor dirs that end with project name
    if (existsSync(CURSOR_SESSION_DIR)) {
      try {
        for (const dir of readdirSync(CURSOR_SESSION_DIR)) {
          if (dir === cursorSlug) continue
          if (dir.endsWith(`-${this.project}`)) {
            const transcripts = join(CURSOR_SESSION_DIR, dir, 'agent-transcripts')
            if (existsSync(transcripts)) paths.push(transcripts)
          }
        }
      } catch {}
    }

    // Codex CLI: date-organized sessions, not project-specific
    if (existsSync(CODEX_SESSION_DIR)) paths.push(CODEX_SESSION_DIR)

    return paths
  }
}
