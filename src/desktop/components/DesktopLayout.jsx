import { SideNav } from './SideNav'
import styles from './DesktopLayout.module.css'

export function DesktopLayout({ children }) {
  return (
    <div className={styles.shell}>
      <SideNav />
      <main className={styles.main}>
        <div className={styles.content}>
          {children}
        </div>
      </main>
    </div>
  )
}
