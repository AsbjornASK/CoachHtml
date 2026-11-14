import { MobileLayout } from '../components/MobileLayout'
import { Card } from '../../shared/components/Card'
import { usePush } from '../../shared/hooks/usePush'
import styles from './ProfilePage.module.css'

export function ProfilePage({ desktop = false }) {
  const { enabled, loading, error, toggle, sendTest } = usePush()

  const content = (
    <>
      <Card title="Push notifications">
        <div className={styles.pushRow}>
          <div className={styles.pushLabel}>
            Morning reminders
            <small className={styles.small}>Daily readiness & check-in</small>
          </div>
          <button
            type="button"
            className={`${styles.toggle} ${enabled ? styles.toggleOn : ''}`}
            onClick={toggle}
            disabled={loading}
            aria-label={enabled ? 'Disable push notifications' : 'Enable push notifications'}
          >
            <span className={styles.toggleThumb} />
          </button>
        </div>

        {enabled && (
          <button type="button" className={styles.testBtn} onClick={sendTest}>
            Send test notification
          </button>
        )}

        {error && <div className={styles.errMsg}>{error}</div>}
      </Card>

      <Card title="About">
        <div className={styles.aboutRow}>
          <span className={styles.aboutLabel}>App version</span>
          <span className={styles.aboutValue}>2.0</span>
        </div>
        <div className={styles.aboutRow}>
          <span className={styles.aboutLabel}>Data source</span>
          <span className={styles.aboutValue}>intervals.icu</span>
        </div>
      </Card>
    </>
  )
  if (desktop) return content
  return <MobileLayout title="Profile">{content}</MobileLayout>
}
