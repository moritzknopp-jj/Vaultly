export interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

/** Maximum number of messages to persist per vault. */
const MAX_MESSAGES = 500

function storageKey(vaultPath: string): string {
  return `vaultly-chat-${btoa(encodeURIComponent(vaultPath)).slice(0, 40)}`
}

export function loadChatHistory(vaultPath: string): StoredMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(vaultPath))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveChatHistory(vaultPath: string, messages: StoredMessage[]): void {
  try {
    const toSave = messages.filter(m => m.content.trim()).slice(-MAX_MESSAGES)
    localStorage.setItem(storageKey(vaultPath), JSON.stringify(toSave))
  } catch {
    // localStorage quota — silently ignore
  }
}

export function clearChatHistory(vaultPath: string): void {
  localStorage.removeItem(storageKey(vaultPath))
}
