/**
 * Secure API key storage using Electron's safeStorage (OS keychain / DPAPI).
 * Keys are encrypted before being written to localStorage, so they are never
 * stored in plain text on disk.
 */

const STORE_KEY = 'vaultly-api-keys'

export interface ServiceDef {
  id: string
  label: string
  placeholder: string
  docsUrl?: string
}

/** Well-known services. Users can also add custom ones. */
export const KNOWN_SERVICES: ServiceDef[] = [
  { id: 'openai',     label: 'OpenAI',          placeholder: 'sk-…',        docsUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic',  label: 'Anthropic',        placeholder: 'sk-ant-…',    docsUrl: 'https://console.anthropic.com/keys' },
  { id: 'groq',       label: 'Groq',             placeholder: 'gsk_…',       docsUrl: 'https://console.groq.com/keys' },
  { id: 'gemini',     label: 'Google Gemini',    placeholder: 'AIza…',       docsUrl: 'https://aistudio.google.com/app/apikey' },
  { id: 'mistral',    label: 'Mistral',          placeholder: 'your-key',    docsUrl: 'https://console.mistral.ai/api-keys/' },
  { id: 'perplexity', label: 'Perplexity',       placeholder: 'pplx-…',      docsUrl: 'https://www.perplexity.ai/settings/api' },
  { id: 'elevenlabs', label: 'ElevenLabs (TTS)', placeholder: 'your-key',    docsUrl: 'https://elevenlabs.io/settings/api-keys' },
  { id: 'stability',  label: 'Stability AI',     placeholder: 'sk-…',        docsUrl: 'https://platform.stability.ai/account/keys' },
  { id: 'custom',     label: '+ Custom…',        placeholder: '' },
]

/** Raw store shape: { [serviceId]: encryptedBase64 } */
function getRawStore(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') } catch { return {} }
}

function saveRawStore(store: Record<string, string>) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store))
}

/** Returns the decrypted key for a service, or '' if not set. */
export async function getApiKey(serviceId: string): Promise<string> {
  const store = getRawStore()
  if (!store[serviceId]) return ''
  try {
    return await window.electronAPI.decryptData(store[serviceId])
  } catch {
    return ''
  }
}

/** Encrypts and saves a key. Pass '' or null to remove it. */
export async function setApiKey(serviceId: string, plaintext: string): Promise<void> {
  const store = getRawStore()
  if (!plaintext.trim()) {
    delete store[serviceId]
  } else {
    store[serviceId] = await window.electronAPI.encryptData(plaintext.trim())
  }
  saveRawStore(store)
}

/** Remove a key without needing its value. */
export function removeApiKey(serviceId: string): void {
  const store = getRawStore()
  delete store[serviceId]
  saveRawStore(store)
}

/** Returns true if a non-empty encrypted blob is stored for the service. */
export function hasApiKey(serviceId: string): boolean {
  return !!getRawStore()[serviceId]
}

/** All service IDs that currently have a key saved. */
export function listStoredServices(): string[] {
  return Object.keys(getRawStore())
}
