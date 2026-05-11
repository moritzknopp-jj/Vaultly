import { useState, useEffect, useMemo } from 'react'
import { getIndexedFiles } from '../../lib/vectorSearch'
import { buildMentionMap } from '../../lib/linkedMentions'
import styles from './NoteEditor.module.css'

interface Props {
  pinnedPaths: string[]
  onPinToggle: (path: string) => void
}

function basename(p: string) {
  return p.replace(/\\/g, '/').split('/').pop()?.replace(/\.md$/i, '') ?? p
}

export default function NoteEditor({ pinnedPaths, onPinToggle }: Props) {
  const files = getIndexedFiles()
  const [query, setQuery] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const mentionMap = useMemo(() => buildMentionMap(files), [files])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return q
      ? files.filter(f => basename(f.path).toLowerCase().includes(q) || f.content.toLowerCase().includes(q))
      : files
  }, [files, query])

  function openFile(path: string) {
    const file = files.find(f => f.path === path)
    if (!file) return
    setSelectedPath(path)
    setContent(file.content)
    setSavedContent(file.content)
    setSaveMsg('')
  }

  async function handleSave() {
    if (!selectedPath) return
    setSaving(true)
    const result = await window.electronAPI.writeVaultFile(selectedPath, content)
    if (result.ok) {
      setSavedContent(content)
      setSaveMsg('Saved ✓')
      setTimeout(() => setSaveMsg(''), 2000)
      // Update in-memory indexed file content
      const f = files.find(f => f.path === selectedPath)
      if (f) f.content = content
    } else {
      setSaveMsg(`Error: ${result.error}`)
    }
    setSaving(false)
  }

  const backlinks = selectedPath
    ? (mentionMap.incoming.get(selectedPath) ?? [])
    : []
  const outlinks = selectedPath
    ? (mentionMap.outgoing.get(selectedPath) ?? [])
    : []

  const isUnsaved = content !== savedContent
  const isPinned = selectedPath ? pinnedPaths.includes(selectedPath) : false

  useEffect(() => {
    if (files.length > 0 && !selectedPath) {
      openFile(files[0].path)
    }
  }, [files.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.root}>
      {/* File browser */}
      <div className={styles.fileList}>
        <div className={styles.fileListHeader}>Notes ({files.length})</div>
        <div className={styles.fileSearch}>
          <input
            className={styles.fileSearchInput}
            placeholder="Search notes…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className={styles.fileItems}>
          {filtered.map(f => (
            <button
              key={f.path}
              className={`${styles.fileItem} ${selectedPath === f.path ? styles.active : ''}`}
              onClick={() => openFile(f.path)}
              title={f.path}
            >
              {basename(f.path)}
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className={styles.editor}>
        {selectedPath ? (
          <>
            <div className={styles.editorHeader}>
              {isUnsaved && <span className={styles.unsavedDot} title="Unsaved changes" />}
              <span className={styles.editorTitle}>{basename(selectedPath)}</span>
              <div className={styles.editorActions}>
                <button
                  className={`${styles.pinBtn} ${isPinned ? styles.pinned : ''}`}
                  onClick={() => onPinToggle(selectedPath)}
                  title={isPinned ? 'Unpin from AI context' : 'Pin to AI context (always included)'}
                >
                  {isPinned ? '📌 Pinned' : '📌 Pin'}
                </button>
                <button
                  className={styles.saveBtn}
                  onClick={handleSave}
                  disabled={saving || !isUnsaved}
                >
                  {saving ? 'Saving…' : saveMsg || 'Save'}
                </button>
              </div>
            </div>

            <textarea
              className={styles.textarea}
              value={content}
              onChange={e => setContent(e.target.value)}
              spellCheck={false}
            />

            {(backlinks.length > 0 || outlinks.length > 0) && (
              <div className={styles.backlinks}>
                {backlinks.length > 0 && (
                  <>
                    <div className={styles.backlinksTitle}>← {backlinks.length} backlink{backlinks.length > 1 ? 's' : ''}</div>
                    {backlinks.map(p => (
                      <button key={p} className={styles.backlinkItem} onClick={() => openFile(p)}>
                        {basename(p)}
                      </button>
                    ))}
                  </>
                )}
                {outlinks.length > 0 && (
                  <>
                    <div className={styles.backlinksTitle} style={{ marginTop: backlinks.length ? 8 : 0 }}>
                      → {outlinks.length} outlink{outlinks.length > 1 ? 's' : ''}
                    </div>
                    {outlinks.map(p => (
                      <button key={p} className={styles.backlinkItem} onClick={() => openFile(p)}>
                        {basename(p)}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyEditor}>Select a note to view or edit</div>
        )}
      </div>
    </div>
  )
}
