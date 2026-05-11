import { useState, useRef, useEffect, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import MessageBubble from './MessageBubble'
import SettingsPanel from '../Settings/SettingsPanel'
import NoteEditor from '../NoteEditor/NoteEditor'
import GraphView from '../Graph/GraphView'
import TitleBar from '../TitleBar'
import Logo from '../Logo'
import { checkOllamaRunning, streamChat, getSelectedModel } from '../../lib/ollama'
import { indexVault, searchVault, getVectorStoreSize, getIndexedFiles } from '../../lib/vectorSearch'
import { loadChatHistory, saveChatHistory, clearChatHistory } from '../../lib/chatHistory'
import { addMemoryEntry, searchMemory, clearMemory, getMemorySize } from '../../lib/conversationMemory'
import styles from './Chat.module.css'

const PINNED_KEY = 'vaultly-pinned-notes'
const DAILY_DIGEST_KEY = 'vaultly-digest-date'

type SideView = 'chat' | 'notes' | 'graph'

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

const VAULT_PATH_KEY = 'vaultly-vault-path'

export default function ChatWindow({ session, trialDaysLeft, isPaid, onSignOut }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [vaultPath, setVaultPath] = useState<string | null>(() => localStorage.getItem(VAULT_PATH_KEY))
  const [isIndexing, setIsIndexing] = useState(false)
  const [indexingProgress, setIndexingProgress] = useState<{ current: number; total: number } | null>(null)
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [sideView, setSideView] = useState<SideView>('chat')
  const [pinnedPaths, setPinnedPaths] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(PINNED_KEY) ?? '[]') } catch { return [] }
  })
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Stable ref so handleVaultPicked (useCallback []) always calls the latest runDailyDigest
  const runDailyDigestRef = useRef<(vp: string) => Promise<void>>(() => Promise.resolve())

  useEffect(() => {
    checkOllamaRunning().then(setOllamaOk)
    const interval = setInterval(() => checkOllamaRunning().then(setOllamaOk), 30000)
    return () => clearInterval(interval)
  }, [])

  // Auto-index the last-used vault on startup
  useEffect(() => {
    const saved = localStorage.getItem(VAULT_PATH_KEY)
    if (saved) handleVaultPicked(saved)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [input])

  function togglePin(path: string) {
    setPinnedPaths(prev => {
      const next = prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
      localStorage.setItem(PINNED_KEY, JSON.stringify(next))
      return next
    })
  }

  async function runDailyDigest(vp: string) {
    const today = new Date().toDateString()
    if (localStorage.getItem(DAILY_DIGEST_KEY) === today) return
    localStorage.setItem(DAILY_DIGEST_KEY, today)

    const files = getIndexedFiles()
    if (files.length === 0) return
    const oneDayAgo = Date.now() - 86_400_000
    const recent = (await Promise.all(
      files.map(async f => ({ f, mtime: await window.electronAPI.getFileMtime(f.path) }))
    )).filter(({ mtime }) => mtime !== null && mtime > oneDayAgo).map(({ f }) => f)

    if (recent.length === 0) return
    const combined = recent.map(f => f.content.slice(0, 600)).join('\n\n---\n\n')
    const digestId = `digest-${Date.now()}`
    const labelId = `digest-label-${Date.now()}`
    setMessages(prev => [...prev,
      { id: labelId, role: 'assistant', content: `📅 **Daily Digest** — ${recent.length} note${recent.length > 1 ? 's' : ''} updated in the last 24h:` },
      { id: digestId, role: 'assistant', content: '', streaming: true },
    ])
    setIsStreaming(true)
    try {
      for await (const chunk of streamChat(
        [{ role: 'user', content: 'Summarize these recently updated notes concisely, in bullet points.' }],
        combined,
        tok => setMessages(prev => prev.map(m => m.id === digestId ? { ...m, content: m.content + tok } : m))
      )) { void chunk }
    } finally {
      setMessages(prev => {
        const done = prev.map(m => m.id === digestId ? { ...m, streaming: false } : m)
        // Persist the digest into chat history
        saveChatHistory(vp, done.filter(m => !m.streaming))
        return done
      })
      setIsStreaming(false)
    }
  }
  // Keep ref fresh on every render so handleVaultPicked's stale closure always calls latest
  runDailyDigestRef.current = runDailyDigest

  async function handleExportChat() {
    if (!vaultPath || messages.length === 0) return
    const date = new Date().toISOString().slice(0, 10)
    const md = `# Vaultly Chat — ${date}\n\n` +
      messages.filter(m => !m.streaming).map(m => `**${m.role === 'user' ? 'You' : 'Vaultly'}:** ${m.content}`).join('\n\n')
    const fileName = `${vaultPath}/Vaultly Chat ${date}.md`
    const result = await window.electronAPI.writeVaultFile(fileName, md)
    setMessages(prev => [...prev, {
      id: `export-${Date.now()}`, role: 'assistant',
      content: result.ok ? `✅ Chat exported to **Vaultly Chat ${date}.md** in your vault.` : `❌ Export failed: ${result.error}`,
    }])
  }

  async function handleSummarize() {
    if (!vaultPath || getVectorStoreSize() === 0 || isStreaming) return
    const topic = input.trim() || 'everything'
    setInput('')
    const summaryMsgId = `summary-${Date.now()}`
    setMessages(prev => [...prev,
      { id: `sq-${Date.now()}`, role: 'user', content: `Summarize my notes about: ${topic}` },
      { id: summaryMsgId, role: 'assistant', content: '', streaming: true },
    ])
    setIsStreaming(true)
    try {
      const context = await searchVault(topic, 8)
      let final = ''
      for await (const chunk of streamChat(
        [{ role: 'user', content: `Summarize the key ideas in my notes about "${topic}" in clear bullet points.` }],
        context,
        tok => {
          final += tok
          setMessages(prev => prev.map(m => m.id === summaryMsgId ? { ...m, content: m.content + tok } : m))
        }
      )) { void chunk }
      if (vaultPath && final) addMemoryEntry(vaultPath, `Summarize: ${topic}`, final)
    } finally {
      setMessages(prev => prev.map(m => m.id === summaryMsgId ? { ...m, streaming: false } : m))
      setIsStreaming(false)
    }
  }

  const handleVaultPicked = useCallback(async (path: string) => {
    localStorage.setItem(VAULT_PATH_KEY, path)
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
      const history = loadChatHistory(path)
      if (history.length > 0) {
        setMessages(history)
      } else {
        setMessages([{
          id: Date.now().toString(),
          role: 'assistant',
          content: `✅ Vault indexed! Loaded **${files.length} notes** → **${count} chunks**.\n\nAsk me anything about your notes.`,
        }])
      }
    } catch (err) {
      setMessages([{
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ Failed to index vault: ${String(err)}`,
      }])
    } finally {
      setIsIndexing(false)
      setIndexingProgress(null)
      // Use ref so stale closure always calls the latest runDailyDigest
      runDailyDigestRef.current(path)
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
      const vaultContext = await searchVault(text)
      const memoryContext = vaultPath ? searchMemory(vaultPath, text) : ''

      // Inject pinned notes content
      let pinnedContext = ''
      if (pinnedPaths.length > 0) {
        const allFiles = getIndexedFiles()
        const pinnedContents = allFiles
          .filter(f => pinnedPaths.includes(f.path))
          .map(f => `### ${f.path.replace(/\\/g, '/').split('/').pop()}\n${f.content.slice(0, 800)}`)
          .join('\n\n')
        if (pinnedContents) pinnedContext = `--- Pinned notes (always include) ---\n${pinnedContents}\n`
      }

      const fullContext = [pinnedContext, vaultContext, memoryContext ? `--- Relevant past conversations ---\n${memoryContext}` : ''].filter(Boolean).join('\n\n')

      const history = messages
        .filter(m => !m.streaming)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      let finalAnswer = ''
      for await (const chunk of streamChat(
        [...history, { role: 'user' as const, content: text }],
        fullContext,
        tok => {
          finalAnswer += tok
          setMessages(prev => prev.map(m =>
            m.id === aiMsgId ? { ...m, content: m.content + tok } : m
          ))
        }
      )) { void chunk }

      // Persist history and add to second brain memory
      if (vaultPath && finalAnswer) {
        addMemoryEntry(vaultPath, text, finalAnswer)
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId
          ? { ...m, content: `⚠ Error: ${String(err)}`, streaming: false }
          : m
      ))
    } finally {
      setMessages(prev => {
        const done = prev.map(m => m.id === aiMsgId ? { ...m, streaming: false } : m)
        if (vaultPath) saveChatHistory(vaultPath, done.filter(m => !m.streaming))
        return done
      })
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
            {/* View switcher */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {(['chat', 'notes', 'graph'] as SideView[]).map(v => (
                <button
                  key={v}
                  className={styles.sidebarBtn}
                  style={{ flex: 1, opacity: sideView === v ? 1 : 0.5, fontWeight: sideView === v ? 700 : 400 }}
                  onClick={() => setSideView(v)}
                  title={v.charAt(0).toUpperCase() + v.slice(1)}
                >
                  {v === 'chat' ? '💬' : v === 'notes' ? '📝' : '🕸'}
                </button>
              ))}
            </div>

            {vaultPath && messages.length > 0 && (
              <>
                <button className={styles.sidebarBtn} onClick={handleExportChat} title="Export chat to vault as .md">
                  <span>📤</span><span>Export chat</span>
                </button>
                <button
                  className={styles.sidebarBtn}
                  title="Clear chat history and memory"
                  onClick={() => {
                    if (!vaultPath) return
                    clearChatHistory(vaultPath)
                    clearMemory(vaultPath)
                    setMessages([])
                  }}
                >
                  <span>🗑</span>
                  <span>Clear chat</span>
                </button>
              </>
            )}
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
          {/* Notes view */}
          {sideView === 'notes' && (
            <NoteEditor pinnedPaths={pinnedPaths} onPinToggle={togglePin} />
          )}

          {/* Graph view */}
          {sideView === 'graph' && (
            <GraphView />
          )}

          {/* Chat view */}
          {sideView === 'chat' && (<>
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
              {getVectorStoreSize() > 0 && (
                <button
                  className={styles.sendBtn}
                  style={{ background: 'transparent', color: 'var(--accent)', fontSize: 13, marginRight: 4, width: 'auto', padding: '0 8px' }}
                  onClick={handleSummarize}
                  disabled={isStreaming || isIndexing}
                  title="Summarize vault (or type a topic first)"
                >
                  ∑
                </button>
              )}
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
                ? `${getVectorStoreSize()} chunks · ${vaultPath ? getMemorySize(vaultPath) : 0} memories · ${getSelectedModel()}`
                : 'Select a vault to enable chat'}
            </p>
          </div>
          </>)}
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
