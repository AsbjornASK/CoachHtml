import styles from './TopBar.module.css'

export function TopBar({ title }) {
  return (
    <header className={styles.bar}>
      <span className={styles.title}>{title}</span>
    </header>
  )
}
