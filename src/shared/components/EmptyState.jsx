import styles from './EmptyState.module.css'

export function EmptyState({ icon = '⚙️', title = 'Setup required', body }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.icon}>{icon}</div>
      <div className={styles.title}>{title}</div>
      {body && <div className={styles.body}>{body}</div>}
    </div>
  )
}
