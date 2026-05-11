import styles from './MessageBubble.module.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface Props {
  message: Message
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`${styles.wrapper} ${isUser ? styles.userWrapper : styles.aiWrapper}`}>
      {!isUser && <span className={styles.avatar}>🤖</span>}
      <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.aiBubble}`}>
        <p className={styles.content}>{message.content || (message.streaming ? '...' : '')}</p>
        {message.streaming && <span className={styles.cursor} />}
      </div>
    </div>
  )
}
