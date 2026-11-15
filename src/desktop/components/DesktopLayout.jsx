import { useLocation } from 'react-router-dom'
import { SideNav } from './SideNav'
import styles from './DesktopLayout.module.css'

const TITLES = {
  '/': 'Coach',
  '/checkin': 'Check-in',
  '/vitals': 'Vitals',
  '/dashboard': 'Dashboard',
  '/data': 'Data',
  '/profile': 'Profile',
}

export function DesktopLayout({ children }) {
  const { pathname } = useLocation()
  const title = TITLES[pathname]
  return (
    <div className={styles.shell}>
      <SideNav />
      <main className={styles.main}>
        <div className={styles.content}>
          {title && <h1 className={styles.title}>{title}</h1>}
          {children}
        </div>
      </main>
    </div>
  )
}
