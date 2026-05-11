import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getDeviceId } from '../../lib/deviceId'
import { getAvailableModels, getSelectedModel, setSelectedModel } from '../../lib/ollama'
import { KNOWN_SERVICES, hasApiKey, setApiKey, removeApiKey, listStoredServices, getApiKey } from '../../lib/apiKeys'
import styles from './Settings.module.css'

interface Props {
  currentVault: string | null
  onVaultPicked: (path: string) => void
  onClose: () => void
  userEmail: string
  userId: string
  trialDaysLeft: number
  isPaid: boolean
  onSignOut: () => void
}

interface DeviceInfo {
  id: string
  isCurrent: boolean
}

export default function SettingsPanel({
  currentVault, onVaultPicked, onClose,
  userEmail, userId, trialDaysLeft, isPaid, onSignOut,
}: Props) {
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('')
  const [removingDevice, setRemovingDevice] = useState<string | null>(null)
  const [loadingDevices, setLoadingDevices] = useState(true)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'none' | 'error'>('idle')
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [availableModels, setAvailableModels] = useState<string[]>([getSelectedModel()])
  const [selectedModel, setSelectedModelState] = useState(getSelectedModel())

  // API keys
  const [savedServices, setSavedServices] = useState<string[]>(() => listStoredServices())
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({})
  const [keyVisible, setKeyVisible] = useState<Record<string, boolean>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [customServiceId, setCustomServiceId] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [activeService, setActiveService] = useState<string | null>(null)

  useEffect(() => { getAvailableModels().then(setAvailableModels) }, [])

  useEffect(() => {
    async function loadDevices() {      setLoadingDevices(true)
      const deviceId = await getDeviceId()
      setCurrentDeviceId(deviceId)

      const { data } = await supabase
        .from('users_meta')
        .select('device_ids')
        .eq('id', userId)
        .single()

      const ids: string[] = data?.device_ids ?? []
      setDevices(ids.map(id => ({ id, isCurrent: id === deviceId })))
      setLoadingDevices(false)
    }
    loadDevices()
  }, [userId])

  async function handlePickVault() {
    const path = await window.electronAPI.pickVaultFolder()
    if (path) onVaultPicked(path)
  }

  async function removeDevice(deviceId: string) {
    if (deviceId === currentDeviceId) return
    setRemovingDevice(deviceId)
    const newIds = devices.filter(d => d.id !== deviceId).map(d => d.id)
    await supabase.from('users_meta').update({ device_ids: newIds }).eq('id', userId)
    setDevices(prev => prev.filter(d => d.id !== deviceId))
    setRemovingDevice(null)
  }

  function shortDeviceId(id: string) {
    return id.slice(0, 8) + '…' + id.slice(-6)
  }

  async function handleCheckUpdate() {
    setUpdateStatus('checking')
    const result = await window.electronAPI.checkForUpdates()
    if (result.hasUpdate) {
      setUpdateStatus('available')
      setUpdateVersion(result.version ?? null)
    } else if (result.error) {
      setUpdateStatus('error')
    } else {
      setUpdateStatus('none')
    }
  }

  async function handleInstallUpdate() {
    await window.electronAPI.downloadAndInstallUpdate()
  }

  async function handleSaveKey(serviceId: string) {
    const val = keyInputs[serviceId] ?? ''
    setSavingKey(serviceId)
    await setApiKey(serviceId, val)
    setSavedServices(listStoredServices())
    setKeyInputs(prev => ({ ...prev, [serviceId]: '' }))
    setActiveService(null)
    setSavingKey(null)
  }

  async function handleLoadKey(serviceId: string) {
    const val = await getApiKey(serviceId)
    setKeyInputs(prev => ({ ...prev, [serviceId]: val }))
    setActiveService(serviceId)
  }

  function handleDeleteKey(serviceId: string) {
    removeApiKey(serviceId)
    setSavedServices(listStoredServices())
    setKeyInputs(prev => { const n = { ...prev }; delete n[serviceId]; return n })
    setActiveService(null)
  }

  function handleAddCustom() {
    const id = customServiceId.trim().toLowerCase().replace(/\s+/g, '-')
    if (!id) return
    setCustomServiceId('')
    setShowCustomInput(false)
    setActiveService(id)
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2 className={styles.headerTitle}>Settings</h2>
          <button className={styles.closeBtn} onClick={onClose} title="Close">✕</button>
        </div>

        {/* Subscription Status */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Subscription</h3>
          <div className={styles.subscriptionCard}>
            {isPaid ? (
              <div className={styles.subStatusRow}>
                <span className={styles.subStatusDot} style={{ background: '#4ade80' }} />
                <div>
                  <p className={styles.subStatusLabel}>Active subscription</p>
                  <p className={styles.subStatusMeta}>$8/month via Bitcoin</p>
                </div>
              </div>
            ) : (
              <div className={styles.subStatusRow}>
                <span
                  className={styles.subStatusDot}
                  style={{ background: trialDaysLeft > 5 ? '#d4af37' : '#f87171' }}
                />
                <div>
                  <p className={styles.subStatusLabel}>
                    Free trial — {trialDaysLeft > 0 ? `${trialDaysLeft} days remaining` : 'Expired'}
                  </p>
                  <p className={styles.subStatusMeta}>
                    {trialDaysLeft > 0
                      ? 'After trial: $8/month paid in Bitcoin'
                      : 'Please complete payment to continue'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* AI Model */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>AI Model</h3>
          <select
            className={styles.primaryBtn}
            value={selectedModel}
            onChange={e => { setSelectedModelState(e.target.value); setSelectedModel(e.target.value) }}
            style={{ fontFamily: 'inherit', cursor: 'pointer' }}
          >
            {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <p className={styles.hint}>Only models installed in Ollama are shown. Embedding always uses <code>nomic-embed-text</code>.</p>
        </section>

        {/* Vault */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Obsidian Vault</h3>
          {currentVault && (
            <div className={styles.vaultPath}>
              <span>📁</span>
              <span className={styles.vaultPathText}>{currentVault}</span>
            </div>
          )}
          <button className={styles.primaryBtn} onClick={handlePickVault}>
            {currentVault ? '⟳  Change vault folder' : '📂  Select vault folder'}
          </button>
          <p className={styles.hint}>
            All <code>.md</code> files in the folder will be indexed for AI search.
          </p>
        </section>

        {/* Devices */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Devices <span className={styles.sectionBadge}>{devices.length}/2</span></h3>
          {loadingDevices ? (
            <p className={styles.loadingText}>Loading devices…</p>
          ) : devices.length === 0 ? (
            <p className={styles.hint}>No devices registered.</p>
          ) : (
            <div className={styles.deviceList}>
              {devices.map(device => (
                <div key={device.id} className={styles.deviceRow}>
                  <div className={styles.deviceInfo}>
                    <span className={styles.deviceIcon}>{device.isCurrent ? '💻' : '🖥'}</span>
                    <div>
                      <p className={styles.deviceId}>{shortDeviceId(device.id)}</p>
                      {device.isCurrent && <p className={styles.deviceCurrent}>This device</p>}
                    </div>
                  </div>
                  {!device.isCurrent && (
                    <button
                      className={styles.removeBtn}
                      onClick={() => removeDevice(device.id)}
                      disabled={removingDevice === device.id}
                    >
                      {removingDevice === device.id ? '…' : 'Remove'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className={styles.hint}>Maximum 2 devices per account.</p>
        </section>

        {/* Requirements */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>AI Requirements</h3>
          <div className={styles.reqList}>
            <div className={styles.reqItem}>
              <span className={styles.reqArrow}>→</span>
              <div>
                <p className={styles.reqTitle}>Ollama</p>
                <p className={styles.reqDesc}>
                  Install from <a href="https://ollama.ai" target="_blank" rel="noreferrer">ollama.ai</a>, then run:
                </p>
                <code className={styles.reqCode}>ollama pull llama3</code>
                <code className={styles.reqCode}>ollama pull nomic-embed-text</code>
              </div>
            </div>
          </div>
        </section>

        {/* Account */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Account</h3>
          <p className={styles.accountEmail}>{userEmail}</p>
          <button className={styles.signOutBtn} onClick={onSignOut}>Sign out</button>
        </section>

        {/* API Keys */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>API Keys</h3>
          <p className={styles.hint}>Keys are encrypted with OS-level security (Windows DPAPI) and never sent to any server.</p>

          <div className={styles.apiKeyList}>
            {/* Well-known services (excluding the meta "custom" entry) */}
            {KNOWN_SERVICES.filter(s => s.id !== 'custom').map(svc => {
              const isSaved = savedServices.includes(svc.id)
              const isEditing = activeService === svc.id
              return (
                <div key={svc.id} className={styles.apiKeyRow}>
                  <div className={styles.apiKeyHeader}>
                    <span className={styles.apiKeyLabel}>
                      {svc.label}
                      {isSaved && <span className={styles.apiKeyBadge}>saved</span>}
                    </span>
                    <div className={styles.apiKeyActions}>
                      {svc.docsUrl && (
                        <a href={svc.docsUrl} target="_blank" rel="noreferrer" className={styles.apiKeyLink}>get key</a>
                      )}
                      {isSaved && !isEditing && (
                        <>
                          <button className={styles.apiKeyEditBtn} onClick={() => handleLoadKey(svc.id)}>edit</button>
                          <button className={styles.apiKeyDeleteBtn} onClick={() => handleDeleteKey(svc.id)}>remove</button>
                        </>
                      )}
                      {!isSaved && !isEditing && (
                        <button className={styles.apiKeyEditBtn} onClick={() => setActiveService(svc.id)}>add</button>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className={styles.apiKeyInputRow}>
                      <div className={styles.apiKeyInputWrapper}>
                        <input
                          type={keyVisible[svc.id] ? 'text' : 'password'}
                          className={styles.apiKeyInput}
                          placeholder={svc.placeholder || 'Paste your API key'}
                          value={keyInputs[svc.id] ?? ''}
                          onChange={e => setKeyInputs(prev => ({ ...prev, [svc.id]: e.target.value }))}
                          autoFocus
                        />
                        <button
                          className={styles.apiKeyVisBtn}
                          onClick={() => setKeyVisible(prev => ({ ...prev, [svc.id]: !prev[svc.id] }))}
                          title={keyVisible[svc.id] ? 'Hide' : 'Show'}
                        >
                          {keyVisible[svc.id] ? '🙈' : '👁'}
                        </button>
                      </div>
                      <button
                        className={styles.primaryBtn}
                        style={{ padding: '6px 14px' }}
                        onClick={() => handleSaveKey(svc.id)}
                        disabled={savingKey === svc.id || !keyInputs[svc.id]?.trim()}
                      >
                        {savingKey === svc.id ? '…' : 'Save'}
                      </button>
                      <button className={styles.apiKeyDeleteBtn} onClick={() => setActiveService(null)}>cancel</button>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Custom services already saved */}
            {savedServices
              .filter(id => !KNOWN_SERVICES.some(s => s.id === id))
              .map(id => {
                const isEditing = activeService === id
                return (
                  <div key={id} className={styles.apiKeyRow}>
                    <div className={styles.apiKeyHeader}>
                      <span className={styles.apiKeyLabel}>
                        {id} <span className={styles.apiKeyBadge}>saved</span>
                      </span>
                      <div className={styles.apiKeyActions}>
                        {!isEditing && (
                          <>
                            <button className={styles.apiKeyEditBtn} onClick={() => handleLoadKey(id)}>edit</button>
                            <button className={styles.apiKeyDeleteBtn} onClick={() => handleDeleteKey(id)}>remove</button>
                          </>
                        )}
                      </div>
                    </div>
                    {isEditing && (
                      <div className={styles.apiKeyInputRow}>
                        <div className={styles.apiKeyInputWrapper}>
                          <input
                            type={keyVisible[id] ? 'text' : 'password'}
                            className={styles.apiKeyInput}
                            placeholder="Paste your API key"
                            value={keyInputs[id] ?? ''}
                            onChange={e => setKeyInputs(prev => ({ ...prev, [id]: e.target.value }))}
                            autoFocus
                          />
                          <button
                            className={styles.apiKeyVisBtn}
                            onClick={() => setKeyVisible(prev => ({ ...prev, [id]: !prev[id] }))}
                          >
                            {keyVisible[id] ? '🙈' : '👁'}
                          </button>
                        </div>
                        <button
                          className={styles.primaryBtn}
                          style={{ padding: '6px 14px' }}
                          onClick={() => handleSaveKey(id)}
                          disabled={savingKey === id || !keyInputs[id]?.trim()}
                        >
                          {savingKey === id ? '…' : 'Save'}
                        </button>
                        <button className={styles.apiKeyDeleteBtn} onClick={() => setActiveService(null)}>cancel</button>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>

          {/* Add custom service */}
          {showCustomInput ? (
            <div className={styles.apiKeyInputRow} style={{ marginTop: 8 }}>
              <input
                type="text"
                className={styles.apiKeyInput}
                placeholder="Service name (e.g. replicate)"
                value={customServiceId}
                onChange={e => setCustomServiceId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
                autoFocus
              />
              <button className={styles.primaryBtn} style={{ padding: '6px 14px' }} onClick={handleAddCustom}>Add</button>
              <button className={styles.apiKeyDeleteBtn} onClick={() => { setShowCustomInput(false); setCustomServiceId('') }}>cancel</button>
            </div>
          ) : (
            <button className={styles.apiKeyEditBtn} style={{ marginTop: 8 }} onClick={() => setShowCustomInput(true)}>
              + Add custom service
            </button>
          )}
        </section>

        {/* Updates */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Updates</h3>
          {updateStatus === 'available' ? (
            <>
              <p className={styles.hint}>Update {updateVersion} is available.</p>
              <button className={styles.primaryBtn} onClick={handleInstallUpdate}>Download &amp; install</button>
            </>
          ) : (
            <button
              className={styles.primaryBtn}
              onClick={handleCheckUpdate}
              disabled={updateStatus === 'checking'}
            >
              {updateStatus === 'checking' ? 'Checking…' : updateStatus === 'none' ? 'Up to date ✓' : updateStatus === 'error' ? 'Check failed — retry' : 'Check for updates'}
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
