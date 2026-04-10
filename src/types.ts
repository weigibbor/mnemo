export type MemoryType = 'decision' | 'rejection' | 'pattern' | 'reference' | 'error'

export interface Memory {
  id: number
  type: MemoryType
  content: string
  reasoning: string | null
  project: string
  branch: string | null
  files: string[]
  tags: string[]
  importance: number
  embedding?: number[]
  createdAt: string
  sessionId: string
}

export interface ExtractedMemory {
  type: MemoryType
  content: string
  reasoning: string | null
  files: string[]
  tags: string[]
  importance: number
}

export interface Session {
  id: string
  project: string
  branch: string | null
  startedAt: string
  endedAt?: string
  memoriesExtracted: number
}
