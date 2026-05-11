import { useState, useRef, useEffect, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import MessageBubble from './MessageBubble'
import SettingsPanel from '../Settings/SettingsPanel'
import TitleBar from '../TitleBar'
import Logo from '../Logo'
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
  trialDaysLeft: number
  isPaid: boolean
  onSignOut: () => void
}

export default function ChatWindow({ session, trialDaysLeft, isPaid, onSignOut }: Props) {
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
    const interval = setInterval(() => checkOllamaRunning().then(setOllamaOk), 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [input])

  const handleVaultPicked = useCallback(async (path: string) => {
    setVaultPath(path)
    setShowSettings(false)
    setIsIndexing(true)
    setMessages([])
    setIndexingProgress(null)

    try {
      const files = await window.electronAPI.readVaultFiles(path)
      if (files.length === 0) {
        setMessages([{
          id: Date.now().toString(),
          role: 'assistant',
          content: '📂 No markdown files found in this folder. Make sure you selected your Obsidian vault directory.',
        }])
        return
      }
      await indexVault(files, (current, total) => setIndexingProgress({ current, total }))
      const count = getVectorStoreSize()
      setMessages([{
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ Vault indexed successfully! Loaded **${files.length} notes** → **${count} searchable chunks**.\n\nAsk me anything about your notes.`,
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
  }, [])

  async function handleSend() {
    const text = input.trim()
    if (!text || isStreaming || isIndexing) return

    if (!vaultPath || getVectorStoreSize() === 0) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: '💡 Please select your Obsidian vault first — click the ⚙ settings icon on the left.',
      }])
      return
    }

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text }
    const aiMsgId = `a-${Date.now()}`

    setMessages(prev => [...prev, userMsg, { id: aiMsgId, role: 'assistant', content: '', streaming: true }])
    setInput('')
    setIsStreaming(true)

    try {
      const context = await searchVault(text)
      const history = messages
        .filter(m => !m.streaming)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      for await (const _ of streamChat(
        [...history, { role: 'user' as const, content: text }],
        context,
        (token) => {
          setMessages(prev => prev.map(m =>
            m.id === aiMsgId ? { ...m, content: m.content + token } : m
          ))
        }
      )) { /* tokens handled in callback */ }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId
          ? { ...m, content: `⚠ Error: ${String(err)}`, streaming: false }
          : m
      ))
    } finally {
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, streaming: false } : m
      ))
      setIsStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const vaultName = vaultPath
    ? vaultPath.split(/[\\/]/).filter(Boolean).pop() ?? vaultPath
    : null

  const isReady = !isIndexing && vaultPath && getVectorStoreSize() > 0

  return (
    <div className={styles.root}>
      <TitleBar title={vaultName ? `Vaultly — ${vaultName}` : 'Vaultly'} />

      <div className={styles.layout}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTop}>
            <div className={styles.sidebarLogo}>
              <Logo size={22} />
              <span className={styles.sidebarAppName}>Vaultly</span>
            </div>

            {vaultName ? (
              <div className={styles.vaultBadge}>
                <span className={styles.vaultBadgeIcon}>📁</span>
                <div className={styles.vaultBadgeInfo}>
                  <span className={styles.vaultBadgeLabel}>Active vault</span>
                  <span className={styles.vaultBadgeName}>{vaultName}</span>
                </div>
              </div>
            ) : (
              <button className={styles.selectVaultBtn} onClick={() => setShowSettings(true)}>
                <span>📂</span>
                <span>Select vault</span>
              </button>
            )}
          </div>

          <div className={styles.sidebarMid}>
            <div className={styles.statusCard}>
              {isPaid ? (
                <>
                  <span className={styles.statusDot} style={{ background: '#4ade80' }} />
                  <span className={styles.statusText}>Subscribed</span>
                </>
              ) : (
                <>
                  <span className={styles.statusDot} style={{ background: trialDaysLeft > 5 ? '#d4af37' : '#f87171' }} />
                  <span className={styles.statusText}>
                    {trialDaysLeft > 0 ? `${trialDaysLeft}d trial left` : 'Trial expired'}
                  </span>
                </>
              )}
            </div>

            <div className={styles.statusCard} style={{ marginTop: 4 }}>
              <span className={styles.statusDot} style={{ background: ollamaOk ? '#4ade80' : ollamaOk === null ? '#888' : '#f87171' }} />
              <span className={styles.statusText}>
                {ollamaOk === null ? 'Checking Ollama...' : ollamaOk ? 'Ollama ready' : 'Ollama offline'}
              </span>
            </div>
          </div>

          <div className={styles.sidebarBottom}>
            <button className={styles.sidebarBtn} onClick={() => setShowSettings(true)}>
              <span>⚙</span>
              <span>Settings</span>
            </button>
            <button className={styles.sidebarBtn} onClick={onSignOut}>
              <span>↩</span>
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className={styles.main}>
          {ollamaOk === false && (
            <div className={styles.ollamaBanner}>
              <span>⚠</span>
              <span>
                Ollama is not running. Install it from{' '}
                <a href="https://ollama.ai" target="_blank" rel="noreferrer">ollama.ai</a>
                {' '}then run: <code>ollama pull llama3 && ollama pull nomic-embed-text</code>
              </span>
            </div>
          )}

          <div className={styles.messages}>
            {messages.length === 0 && !isIndexing && (
              <div className={styles.emptyState}>
                <Logo size={56} />
                <h2 className={styles.emptyTitle}>
                  {isReady ? 'Your vault is ready' : 'Welcome to Vaultly'}
                </h2>
                <p className={styles.emptySubtitle}>
                  {vaultPath
                    ? isReady
                      ? 'Ask me anything about your notes.'
                      : 'Vault selected. Start indexing by asking a question.'
                    : 'Select your Obsidian vault from settings to get started.'}
                </p>
                {!vaultPath && (
                  <button className={styles.emptyAction} onClick={() => setShowSettings(true)}>
                    Select vault folder →
                  </button>
                )}
              </div>
            )}

            {isIndexing && (
              <div className={styles.indexingState}>
                <div className={styles.indexingSpinner} />
                <div className={styles.indexingText}>
                  {indexingProgress
                    ? `Embedding chunks… ${indexingProgress.current} / ${indexingProgress.total}`
                    : 'Reading vault files…'}
                </div>
                {indexingProgress && (
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${(indexingProgress.current / indexingProgress.total) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} />
          </div>

          <div className={styles.inputArea}>
            <div className={styles.inputWrapper}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isIndexing ? 'Indexing vault…' : 'Ask anything about your notes… (Enter to send, Shift+Enter for newline)'}
                rows={1}
                disabled={isStreaming || isIndexing}
              />
              <button
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={isStreaming || isIndexing || !input.trim()}
                title="Send (Enter)"
              >
                {isStreaming ? <span className={styles.sendSpinner} /> : '↑'}
              </button>
            </div>
            <p className={styles.inputHint}>
              {isReady
                ? `${getVectorStoreSize()} chunks indexed · llama3 via Ollama`
                : 'Select a vault to enable chat'}
            </p>
          </div>
        </main>
      </div>

      {showSettings && (
        <SettingsPanel
          currentVault={vaultPath}
          onVaultPicked={handleVaultPicked}
          onClose={() => setShowSettings(false)}
          userEmail={session.user.email ?? ''}
          userId={session.user.id}
          trialDaysLeft={trialDaysLeft}
          isPaid={isPaid}
          onSignOut={onSignOut}
        />
      )}
    </div>
  )
}
