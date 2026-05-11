import { embedText } from './ollama'

interface VaultFile {
  path: string
  content: string
}

interface Chunk {
  text: string
  source: string
}

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.slice(start, end))
    start += chunkSize - overlap
    if (start >= text.length) break
  }
  return chunks
}

interface VectorEntry {
  embedding: number[]
  text: string
  source: string
}

let vectorStore: VectorEntry[] = []

export function clearVectorStore() {
  vectorStore = []
}

export async function indexVault(
  files: VaultFile[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  vectorStore = []
  const allChunks: Chunk[] = []

  for (const file of files) {
    const chunks = chunkText(file.content)
    for (const chunk of chunks) {
      allChunks.push({ text: chunk, source: file.path })
    }
  }

  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i]
    try {
      const embedding = await embedText(chunk.text)
      vectorStore.push({ embedding, text: chunk.text, source: chunk.source })
    } catch (err) {
      console.warn(`Failed to embed chunk from ${chunk.source}:`, err)
    }
    onProgress?.(i + 1, allChunks.length)
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export async function searchVault(query: string, topK = 5): Promise<string> {
  if (vectorStore.length === 0) return ''

  const queryEmbedding = await embedText(query)

  const scored = vectorStore.map(entry => ({
    ...entry,
    score: cosineSimilarity(queryEmbedding, entry.embedding),
  }))

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, topK)

  return top.map(entry => `[${entry.source}]\n${entry.text}`).join('\n\n---\n\n')
}

export function getVectorStoreSize(): number {
  return vectorStore.length
}
