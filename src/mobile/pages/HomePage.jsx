import { MobileLayout } from '../components/MobileLayout'
import { Card } from '../../shared/components/Card'
import { Ring } from '../../shared/components/Ring'
import { useCoach } from '../../shared/hooks/useCoach'
import { calcRecovery, calcSleep, calcReadiness, verdictColor } from '../../shared/utils/readiness'
import styles from './HomePage.module.css'

function fmtN(v, unit = '') {
  if (v == null) return '–'
  return String(v).replace('.', ',') + (unit ? ' ' + unit : '')
}

function MetricItem({ label, value, unit, color }) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue} style={color ? { color } : undefined}>
        {fmtN(value)}
        {unit && <span className={styles.metricUnit}>{unit}</span>}
      </div>
    </div>
  )
}

export function HomePage() {
  const { data, loading, error } = useCoach()

  let content
  if (loading) {
    content = (
      <>
        <div className={`${styles.skeleton} ${styles.skelCard}`} />
        <div className={`${styles.skeleton} ${styles.skelCard}`} />
      </>
    )
  } else if (error) {
    content = <div className={styles.error}>Could not load data: {error}</div>
  } else {
    const { latest, trends, sleep8, subjective } = data
    const rec = calcRecovery(latest.hrv, latest.restingHR, latest.sleepHours, latest.tsb)
    const slp = calcSleep(latest.sleepHours, latest.sleepScore, sleep8)
    const ready = calcReadiness(rec, slp, subjective)

    const rColor = ready != null ? verdictColor(ready) : '#aeaeb2'
    const recColor = rec != null ? verdictColor(rec) : '#aeaeb2'
    const slpColor = slp != null ? verdictColor(slp) : '#aeaeb2'

    content = (
      <>
        <Card>
          <div className={styles.rings}>
            <Ring pct={ready} color={rColor} label="Readiness" />
            <Ring pct={rec} color={recColor} label="Recovery" />
            <Ring pct={slp} color={slpColor} label="Sleep" />
          </div>
        </Card>

        <div className={styles.sectionHeader}>Physio</div>
        <Card>
          <div className={styles.metrics}>
            <MetricItem label="Night HRV" value={latest.hrv} unit="ms" />
            <MetricItem label="Resting HR" value={latest.restingHR} unit="bpm" />
            <MetricItem label="Sleep" value={latest.sleepHours} unit="h" />
            <MetricItem label="Sleep score" value={latest.sleepScore} />
          </div>
        </Card>

        <div className={styles.sectionHeader}>Fitness</div>
        <Card>
          <div className={styles.metrics}>
            <MetricItem label="Fitness (CTL)" value={latest.ctl} />
            <MetricItem label="Fatigue (ATL)" value={latest.atl} />
            <MetricItem
              label="TSB"
              value={latest.tsb}
              color={(latest.tsb ?? 0) >= 0 ? '#30d158' : '#ff9f0a'}
            />
            <MetricItem label="Ramp rate" value={latest.rampRate} />
          </div>
        </Card>
      </>
    )
  }

  return <MobileLayout title="Coach">{content}</MobileLayout>
}
