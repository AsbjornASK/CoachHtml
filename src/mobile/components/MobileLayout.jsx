import { useRef, useState, useCallback } from 'react'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import styles from './MobileLayout.module.css'

const PULL_THRESHOLD = 60

export function MobileLayout({ title, children, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(null)
  const pulled = useRef(0)

  const handleTouchStart = useCallback((e) => {
    if (!onRefresh) return
    if (e.currentTarget.scrollTop > 0) return
    startY.current = e.touches[0].clientY
  }, [onRefresh])

  const handleTouchMove = useCallback((e) => {
    if (startY.current == null) return
    const delta = e.touches[0].clientY - startY.current
    if (delta <= 0) { startY.current = null; return }
    pulled.current = delta
  }, [])

  const handleTouchEnd = useCallback(async () => {
    if (startY.current == null) return
    const wasPulled = pulled.current >= PULL_THRESHOLD
    startY.current = null
    pulled.current = 0
    if (wasPulled && onRefresh) {
      setRefreshing(true)
      try { await onRefresh() } finally { setRefreshing(false) }
    }
  }, [onRefresh])

  return (
    <div className={styles.layout}>
      <TopBar title={title} />
      <main
        className={styles.content}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {refreshing && <div className={styles.refreshSpinner} aria-label="Refreshing…" />}
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
