import Anthropic from '@anthropic-ai/sdk'
import type { ExtractedMemory, MemoryType } from '../types.js'
import { log } from '../utils/logger.js'

const client = new Anthropic()

const EXTRACTION_PROMPT = `You are mnemo, a memory extraction engine for AI coding sessions.

Analyze the following AI coding session transcript and extract the most important memories worth persisting.

Focus ONLY on:
- DECISIONS: Architectural or implementation choices made and WHY
- REJECTIONS: Approaches tried and abandoned and WHY they failed
- PATTERNS: Recurring conventions or rules for this codebase
- REFERENCES: Where important things live
- ERRORS: Error patterns encountered and their fixes

DO NOT extract:
- Generic programming advice
- Things the AI said that weren't accepted by the developer
- Trivial implementation details
- Anything not specific to this codebase

Rate importance 1-10:
- 10: Critical architecture decision that will affect everything
- 7-9: Important pattern or decision
- 4-6: Useful reference or minor pattern
- 1-3: Minor detail

Respond with ONLY a JSON array. No prose, no markdown fences. Example:
[
  {
    "type": "decision",
    "content": "Using Postgres instead of MySQL for JSONB support on user preferences",
    "reasoning": "Need flexible schema for user preference storage without migrations",
    "files": ["src/db/schema.ts"],
    "tags": ["database", "postgres", "preferences"],
    "importance": 8
  }
]

If nothing is worth extracting, return an empty array: []`

export async function extractMemories(
  transcript: string,
  project: string,
  _branch?: string | null
): Promise<ExtractedMemory[]> {
  if (transcript.trim().length < 100) {
    log('info', `extract skipped — transcript too short (${transcript.trim().length} chars)`)
    return []
  }

  try {
    const response = await client.messages.create({
      model: process.env.MNEMO_EXTRACT_MODEL || 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: 'user',
          content: `PROJECT: ${project}\n\nSESSION TRANSCRIPT:\n${transcript.slice(-8000)}`,
        },
      ],
    })

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as any).text)
      .join('')
      .trim()

    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return []

    const valid = parsed.filter(isValidMemory)
    log('info', `extracted ${valid.length} memories from ${transcript.length} char transcript`)
    return valid
  } catch (err) {
    log('error', `extraction failed: ${err instanceof Error ? err.message : String(err)}`)
    return []
  }
}

export async function recallQuery(
  query: string,
  memories: { type: MemoryType; content: string; reasoning: string | null; importance: number }[]
): Promise<string> {
  if (memories.length === 0) {
    return `No memories found for: "${query}"\n\nStart a session with \`mnemo watch\` to begin capturing context.`
  }

  const memoryContext = memories
    .map(
      (m, i) =>
        `[${i + 1}] TYPE: ${m.type.toUpperCase()} (importance: ${m.importance}/10)\n${m.content}${m.reasoning ? `\nREASONING: ${m.reasoning}` : ''}`
    )
    .join('\n\n')

  const response = await client.messages.create({
    model: process.env.MNEMO_RECALL_MODEL || 'claude-sonnet-4-5',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `You are mnemo, a memory recall assistant for a developer's codebase.

Based on these stored memories, answer the developer's question concisely and directly.
Cite the memory number when relevant. If memories don't directly answer, say so.

MEMORIES:
${memoryContext}

QUESTION: ${query}`,
      },
    ],
  })

  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as any).text)
    .join('')
    .trim()
}

function isValidMemory(m: any): m is ExtractedMemory {
  return (
    typeof m === 'object' &&
    ['decision', 'rejection', 'pattern', 'reference', 'error'].includes(m.type) &&
    typeof m.content === 'string' &&
    m.content.length > 10 &&
    typeof m.importance === 'number'
  )
}
