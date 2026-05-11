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

function renderContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className={styles.inlineCode}>{part.slice(1, -1)}</code>
    }
    return <span key={i}>{part}</span>
  })
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className={styles.userRow}>
        <div className={styles.userBubble}>
          <p className={styles.content}>{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.aiRow}>
      <div className={styles.aiAvatar}>
        <span>V</span>
      </div>
      <div className={styles.aiContent}>
        <div className={styles.aiBubble}>
          {message.content ? (
            <p className={styles.content}>
              {renderContent(message.content)}
              {message.streaming && <span className={styles.cursor} />}
            </p>
          ) : message.streaming ? (
            <div className={styles.thinkingDots}>
              <span /><span /><span />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
