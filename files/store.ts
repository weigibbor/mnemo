import Database from 'better-sqlite3'
import { join } from 'path'
import { homedir } from 'os'
import { mkdirSync } from 'fs'
import type { Memory, Session } from '../types.js'
import { cosineSimilarity } from '../core/embeddings.js'

const MNEMO_DIR = join(homedir(), '.mnemo')
const DB_PATH = join(MNEMO_DIR, 'memories.db')

export function getDb(): Database.Database {
  mkdirSync(MNEMO_DIR, { recursive: true })
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  initSchema(db)
  runMigrations(db)
  return db
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT    PRIMARY KEY,
      project     TEXT    NOT NULL,
      branch      TEXT,
      started_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      ended_at    TEXT,
      memories_extracted INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS memories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT    NOT NULL CHECK(type IN ('decision','rejection','pattern','reference','error')),
      content     TEXT    NOT NULL,
      reasoning   TEXT,
      project     TEXT    NOT NULL,
      branch      TEXT,
      files       TEXT    NOT NULL DEFAULT '[]',
      tags        TEXT    NOT NULL DEFAULT '[]',
      importance  INTEGER NOT NULL DEFAULT 5 CHECK(importance BETWEEN 1 AND 10),
      embedding   TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      session_id  TEXT    NOT NULL REFERENCES sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_memories_project    ON memories(project);
    CREATE INDEX IF NOT EXISTS idx_memories_branch     ON memories(project, branch);
    CREATE INDEX IF NOT EXISTS idx_memories_type       ON memories(type);
    CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content, reasoning, tags,
      content='memories',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, reasoning, tags)
      VALUES (new.id, new.content, COALESCE(new.reasoning,''), COALESCE(new.tags,''));
    END;

    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, reasoning, tags)
      VALUES ('delete', old.id, old.content, COALESCE(old.reasoning,''), COALESCE(old.tags,''));
    END;
  `)
}

function runMigrations(db: Database.Database): void {
  const cols = db.pragma('table_info(memories)') as { name: string }[]
  if (!cols.find((c) => c.name === 'embedding')) {
    db.exec('ALTER TABLE memories ADD COLUMN embedding TEXT')
  }
}

export function saveMemory(
  db: Database.Database,
  memory: Omit<Memory, 'id' | 'createdAt'> & { embedding?: number[] }
): number {
  const result = db.prepare(`
    INSERT INTO memories (type, content, reasoning, project, branch, files, tags, importance, embedding, session_id)
    VALUES (@type, @content, @reasoning, @project, @branch, @files, @tags, @importance, @embedding, @sessionId)
  `).run({
    ...memory,
    files: JSON.stringify(memory.files),
    tags:  JSON.stringify(memory.tags),
    embedding: memory.embedding ? JSON.stringify(memory.embedding) : null,
  })
  return result.lastInsertRowid as number
}

export function updateEmbedding(db: Database.Database, id: number, embedding: number[]): void {
  db.prepare('UPDATE memories SET embedding = ? WHERE id = ?').run(JSON.stringify(embedding), id)
}

export function searchMemories(
  db: Database.Database,
  query: string,
  queryEmbedding: number[] | null,
  project: string,
  branch: string | null,
  limit = 12
): Memory[] {
  let rows: any[]
  try {
    rows = db.prepare(`
      SELECT m.* FROM memories m
      JOIN memories_fts fts ON m.id = fts.rowid
      WHERE memories_fts MATCH ? AND m.project = ?
      ORDER BY m.importance DESC, m.created_at DESC
      LIMIT 40
    `).all(sanitizeFts(query), project)
  } catch {
    rows = []
  }

  if (rows.length === 0) {
    rows = db.prepare(
      'SELECT * FROM memories WHERE project = ? ORDER BY importance DESC, created_at DESC LIMIT 40'
    ).all(project)
  }

  const memories = rows.map(deserialize)

  const scored = memories.map((m) => {
    let score = m.importance / 10

    if (queryEmbedding && m.embedding) {
      score += cosineSimilarity(queryEmbedding, m.embedding) * 0.5
    }

    if (branch && m.branch === branch) score += 0.3
    else if (!m.branch) score += 0.1

    const daysAgo = (Date.now() - new Date(m.createdAt).getTime()) / 86_400_000
    score -= Math.min(daysAgo, 30) / 300

    return { memory: m, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.memory)
}

export function getRecentMemories(
  db: Database.Database,
  project: string,
  branch: string | null,
  limit = 20
): Memory[] {
  const rows = branch
    ? db.prepare(`
        SELECT * FROM memories WHERE project = ?
        ORDER BY CASE WHEN branch = ? THEN 1 ELSE 0 END DESC, importance DESC, created_at DESC
        LIMIT ?
      `).all(project, branch, limit)
    : db.prepare(`
        SELECT * FROM memories WHERE project = ?
        ORDER BY importance DESC, created_at DESC LIMIT ?
      `).all(project, limit)
  return (rows as any[]).map(deserialize)
}

export function getSessionMemories(db: Database.Database, sessionId: string): Memory[] {
  return (db.prepare(
    'SELECT * FROM memories WHERE session_id = ? ORDER BY created_at ASC'
  ).all(sessionId) as any[]).map(deserialize)
}

export function deleteMemory(db: Database.Database, id: number): boolean {
  return db.prepare('DELETE FROM memories WHERE id = ?').run(id).changes > 0
}

export function createSession(
  db: Database.Database,
  session: Omit<Session, 'endedAt' | 'memoriesExtracted'>
): void {
  db.prepare(`
    INSERT INTO sessions (id, project, branch, started_at)
    VALUES (@id, @project, @branch, @startedAt)
  `).run(session)
}

export function endSession(db: Database.Database, sessionId: string, count: number): void {
  db.prepare(
    'UPDATE sessions SET ended_at = datetime("now"), memories_extracted = ? WHERE id = ?'
  ).run(count, sessionId)
}

export function getStats(db: Database.Database, project: string) {
  const total = (db.prepare('SELECT COUNT(*) as count FROM memories WHERE project = ?').get(project) as any).count
  const byTypeRows = db.prepare('SELECT type, COUNT(*) as count FROM memories WHERE project = ? GROUP BY type').all(project) as any[]
  const byType: Record<string, number> = {}
  for (const r of byTypeRows) byType[r.type] = r.count
  const sessions = (db.prepare('SELECT COUNT(*) as count FROM sessions WHERE project = ?').get(project) as any).count
  const lastRow = db.prepare('SELECT created_at FROM memories WHERE project = ? ORDER BY created_at DESC LIMIT 1').get(project) as any
  const branches = (db.prepare('SELECT DISTINCT branch FROM memories WHERE project = ? AND branch IS NOT NULL').all(project) as any[]).map(r => r.branch)
  return { total, byType, sessions, branches, lastCaptured: lastRow ? new Date(lastRow.created_at).toLocaleString() : null }
}

function deserialize(row: any): Memory {
  return {
    ...row,
    files: JSON.parse(row.files || '[]'),
    tags:  JSON.parse(row.tags  || '[]'),
    embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
    createdAt: row.created_at,
    sessionId: row.session_id,
  }
}

function sanitizeFts(q: string): string {
  return q.replace(/['"*:]/g, ' ').trim() || '*'
}
