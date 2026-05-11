import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getDeviceId } from '../../lib/deviceId'
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

  useEffect(() => {
    async function loadDevices() {
      setLoadingDevices(true)
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
      </div>
    </div>
  )
}
