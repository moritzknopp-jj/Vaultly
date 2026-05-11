interface MemoryEntry {
  question: string
  answer: string
  ts: number
}

const MAX_ENTRIES = 300

function storageKey(vaultPath: string): string {
  return `vaultly-memory-${btoa(encodeURIComponent(vaultPath)).slice(0, 40)}`
}

function loadEntries(vaultPath: string): MemoryEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(vaultPath))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveEntries(vaultPath: string, entries: MemoryEntry[]): void {
  try {
    localStorage.setItem(storageKey(vaultPath), JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch { /* quota */ }
}

export function addMemoryEntry(vaultPath: string, question: string, answer: string): void {
  const entries = loadEntries(vaultPath)
  entries.push({ question, answer: answer.slice(0, 1500), ts: Date.now() })
  saveEntries(vaultPath, entries)
}

/** Tokenize to meaningful words (strips punctuation, short words). */
function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9äöüß ]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  )
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let n = 0
  for (const w of a) if (b.has(w)) n++
  return n
}

/**
 * Search past conversations for entries relevant to the current query.
 * Returns a formatted string to inject into the AI context, or '' if nothing found.
 */
export function searchMemory(vaultPath: string, query: string, topK = 4): string {
  const entries = loadEntries(vaultPath)
  if (entries.length === 0) return ''

  const qTokens = tokenize(query)
  const scored = entries
    .map(e => ({ e, score: overlapScore(qTokens, tokenize(e.question)) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  if (scored.length === 0) return ''
  return scored.map(({ e }) => `Q: ${e.question}\nA: ${e.answer}`).join('\n\n')
}

export function clearMemory(vaultPath: string): void {
  localStorage.removeItem(storageKey(vaultPath))
}

export function getMemorySize(vaultPath: string): number {
  return loadEntries(vaultPath).length
}
