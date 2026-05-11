import styles from './Settings.module.css'

interface Props {
  currentVault: string | null
  onVaultPicked: (path: string) => void
  onClose: () => void
  userEmail: string
  onSignOut: () => void
}

export default function VaultPicker({ currentVault, onVaultPicked, onClose, userEmail, onSignOut }: Props) {
  async function handlePickVault() {
    const path = await window.electronAPI.pickVaultFolder()
    if (path) {
      onVaultPicked(path)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Settings</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Obsidian Vault</h3>
          {currentVault && (
            <div className={styles.currentVault}>
              <span className={styles.vaultIcon}>📁</span>
              <span className={styles.vaultPath}>{currentVault}</span>
            </div>
          )}
          <button className={styles.pickBtn} onClick={handlePickVault}>
            {currentVault ? 'Change Vault Folder' : 'Select Vault Folder'}
          </button>
          <p className={styles.hint}>
            Select your Obsidian vault folder. All .md files will be indexed for search.
          </p>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Account</h3>
          <p className={styles.accountEmail}>{userEmail}</p>
          <button className={styles.signOutBtn} onClick={onSignOut}>
            Sign Out
          </button>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Requirements</h3>
          <div className={styles.requirements}>
            <div className={styles.req}>
              <span className={styles.reqBullet}>→</span>
              <div>
                <p className={styles.reqTitle}>Ollama</p>
                <p className={styles.reqDesc}>Install from <a href="https://ollama.ai" target="_blank" rel="noreferrer">ollama.ai</a> and run: <code>ollama pull llama3 && ollama pull nomic-embed-text</code></p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
