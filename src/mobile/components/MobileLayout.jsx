import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import styles from './MobileLayout.module.css'

export function MobileLayout({ title, children }) {
  return (
    <div className={styles.layout}>
      <TopBar title={title} />
      <main className={styles.content}>{children}</main>
      <BottomNav />
    </div>
  )
}
