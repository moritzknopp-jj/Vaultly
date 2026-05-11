const OLLAMA_BASE = 'http://localhost:11434'

export async function checkOllamaRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_BASE}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
  })
  if (!res.ok) throw new Error(`Ollama embed failed: ${res.statusText}`)
  const data = await res.json()
  return data.embedding
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function* streamChat(
  messages: ChatMessage[],
  context: string,
  onToken: (token: string) => void
): AsyncGenerator<string> {
  const systemMessage: ChatMessage = {
    role: 'system',
    content: `You are a helpful assistant. Answer questions based only on the provided notes context. If the answer is not in the notes, say so.\n\nContext from notes:\n${context}`,
  }

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3',
      messages: [systemMessage, ...messages],
      stream: true,
    }),
  })

  if (!res.ok) throw new Error(`Ollama chat failed: ${res.statusText}`)
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value)
    const lines = chunk.split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line)
        if (parsed.message?.content) {
          onToken(parsed.message.content)
          yield parsed.message.content
        }
      } catch {
        // skip invalid JSON lines
      }
    }
  }
}
