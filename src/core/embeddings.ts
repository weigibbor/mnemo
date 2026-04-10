import Anthropic from '@anthropic-ai/sdk'
import { log } from '../utils/logger.js'

const client = new Anthropic()

/**
 * Generate a 32-float semantic embedding for a memory string.
 * Used for cosine similarity search alongside FTS5.
 */
export async function embed(text: string): Promise<number[]> {
  const response = await client.messages.create({
    model: process.env.MNEMO_EMBED_MODEL || 'claude-haiku-4-5',
    max_tokens: 64,
    system:
      'Return ONLY a JSON array of 32 floats representing the semantic embedding of the input. No prose.',
    messages: [{ role: 'user', content: text.slice(0, 512) }],
  })

  try {
    let raw = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as any).text)
      .join('')
      .trim()
    // Strip markdown code fences if model wraps JSON in ```json ... ```
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((n) => typeof n === 'number')) {
      return parsed
    }
  } catch (err) {
    log('warn', `embedding parse failed, using fallback: ${err instanceof Error ? err.message : String(err)}`)
  }

  return simpleBowVector(text)
}

/** Cosine similarity between two vectors. Returns 0-1. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

/** Deterministic bag-of-words fallback vector. */
function simpleBowVector(text: string): number[] {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
  const vec = new Array(32).fill(0)
  for (const word of words) {
    let h = 5381
    for (let i = 0; i < word.length; i++) {
      h = ((h << 5) + h) ^ word.charCodeAt(i)
      h = h >>> 0
    }
    vec[h % 32] += 1
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map((v) => v / norm)
}
