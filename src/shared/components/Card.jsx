import styles from './Card.module.css'

export function Card({ title, subtitle, children, className = '' }) {
  return (
    <div className={`${styles.card} ${className}`}>
      {title && <div className={styles.title}>{title}</div>}
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      {children}
    </div>
  )
}
