import { useState, useRef, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import MessageBubble from './MessageBubble'
import VaultPicker from '../Settings/VaultPicker'
import { checkOllamaRunning, streamChat } from '../../lib/ollama'
import { indexVault, searchVault, getVectorStoreSize } from '../../lib/vectorSearch'
import styles from './Chat.module.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface Props {
  session: Session
  onSignOut: () => void
}

export default function ChatWindow({ session, onSignOut }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [isIndexing, setIsIndexing] = useState(false)
  const [indexingProgress, setIndexingProgress] = useState<{ current: number; total: number } | null>(null)
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    checkOllamaRunning().then(setOllamaOk)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleVaultPicked(path: string) {
    setVaultPath(path)
    setShowSettings(false)
    setIsIndexing(true)
    setMessages([])

    try {
      const files = await window.electronAPI.readVaultFiles(path)
      await indexVault(files, (current, total) => {
        setIndexingProgress({ current, total })
      })
      setMessages([{
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ Indexed ${getVectorStoreSize()} chunks from your vault. Ask me anything!`,
      }])
    } catch (err) {
      setMessages([{
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ Failed to index vault: ${String(err)}`,
      }])
    } finally {
      setIsIndexing(false)
      setIndexingProgress(null)
    }
  }

  async function handleSend() {
    if (!input.trim() || isStreaming) return
    if (!vaultPath || getVectorStoreSize() === 0) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Please select your Obsidian vault first using the settings icon.',
      }])
      return
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    }
    const aiMsgId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, userMsg, {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      streaming: true,
    }])
    setInput('')
    setIsStreaming(true)

    try {
      const context = await searchVault(userMsg.content)
      const history = messages.map(m => ({ role: m.role, content: m.content }))

      for await (const _token of streamChat(
        [...history, { role: 'user' as const, content: userMsg.content }],
        context,
        (token) => {
          setMessages(prev =>
            prev.map(m => m.id === aiMsgId
              ? { ...m, content: m.content + token }
              : m
            )
          )
        }
      )) {
        // streaming handled in onToken callback
      }
    } catch (err) {
      setMessages(prev =>
        prev.map(m => m.id === aiMsgId
          ? { ...m, content: `Error: ${String(err)}`, streaming: false }
          : m
        )
      )
    } finally {
      setMessages(prev =>
        prev.map(m => m.id === aiMsgId ? { ...m, streaming: false } : m)
      )
      setIsStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const vaultName = vaultPath ? vaultPath.split(/[\\/]/).pop() ?? vaultPath : null

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.appName}>🔐 Vaultly</span>
        </div>
        <div className={styles.sidebarContent}>
          {vaultName && (
            <div className={styles.vaultChip}>
              <span className={styles.vaultIcon}>📁</span>
              <span className={styles.vaultName}>{vaultName}</span>
            </div>
          )}
          {!vaultName && (
            <p className={styles.noVault}>No vault selected</p>
          )}
        </div>
        <div className={styles.sidebarFooter}>
          <button className={styles.settingsBtn} onClick={() => setShowSettings(true)} title="Settings">
            ⚙
          </button>
          <button className={styles.signOutBtn} onClick={onSignOut} title="Sign out">
            ⎋
          </button>
        </div>
      </aside>

      {/* Main chat area */}
      <main className={styles.main}>
        {/* Custom title bar drag area */}
        <div className={styles.titleBar} />

        {/* Ollama warning */}
        {ollamaOk === false && (
          <div className={styles.ollamaWarning}>
            ⚠ Please install and start Ollama from{' '}
            <a href="https://ollama.ai" target="_blank" rel="noreferrer" className={styles.ollamaLink}>
              ollama.ai
            </a>
          </div>
        )}

        {/* Messages */}
        <div className={styles.messages}>
          {messages.length === 0 && !isIndexing && (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Vaultly</p>
              <p className={styles.emptySubtitle}>
                {vaultPath
                  ? 'Your vault is ready. Ask anything.'
                  : 'Open settings to select your Obsidian vault.'}
              </p>
            </div>
          )}
          {isIndexing && (
            <div className={styles.indexing}>
              <div className={styles.spinner} />
              {indexingProgress
                ? `Indexing... ${indexingProgress.current} / ${indexingProgress.total} chunks`
                : 'Reading vault files...'}
            </div>
          )}
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className={styles.inputArea}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask something about your notes..."
            rows={1}
            disabled={isStreaming || isIndexing}
          />
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={isStreaming || isIndexing || !input.trim()}
          >
            ↑
          </button>
        </div>
      </main>

      {/* Settings overlay */}
      {showSettings && (
        <VaultPicker
          currentVault={vaultPath}
          onVaultPicked={handleVaultPicked}
          onClose={() => setShowSettings(false)}
          userEmail={session.user.email ?? ''}
          onSignOut={onSignOut}
        />
      )}
    </div>
  )
}
