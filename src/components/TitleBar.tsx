import Logo from './Logo'
import styles from './TitleBar.module.css'

interface Props {
  title?: string
}

export default function TitleBar({ title = 'Vaultly' }: Props) {
  function minimize() {
    window.electronAPI?.minimize()
  }
  function maximize() {
    window.electronAPI?.maximize()
  }
  function close() {
    window.electronAPI?.close()
  }

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <Logo size={16} />
        <span className={styles.title}>{title}</span>
      </div>
      <div className={styles.controls}>
        <button className={styles.btn} onClick={minimize} title="Minimize">
          <span className={styles.minimizeIcon} />
        </button>
        <button className={styles.btn} onClick={maximize} title="Maximize">
          <span className={styles.maximizeIcon} />
        </button>
        <button className={`${styles.btn} ${styles.closeBtn}`} onClick={close} title="Close">
          <span className={styles.closeIcon} />
        </button>
      </div>
    </div>
  )
}
