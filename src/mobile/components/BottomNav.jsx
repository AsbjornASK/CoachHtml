import { NavLink } from 'react-router-dom'
import styles from './BottomNav.module.css'

const NAV_ITEMS = [
  {
    to: '/checkin',
    label: 'Check-in',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx={12} cy={12} r={9}/>
        <polyline points="8 12 11 15 16 9"/>
      </svg>
    ),
  },
  {
    to: '/',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    to: '/vitals',
    label: 'Vitals',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="2 12 7 12 10 19 14 5 17 12 22 12"/>
      </svg>
    ),
  },
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <line x1={6} y1={20} x2={6} y2={10}/>
        <line x1={12} y1={20} x2={12} y2={4}/>
        <line x1={18} y1={20} x2={18} y2={14}/>
      </svg>
    ),
  },
]

export function BottomNav() {
  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `${styles.item}${isActive ? ' ' + styles.active : ''}`}
          >
            <span className={styles.icon}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
