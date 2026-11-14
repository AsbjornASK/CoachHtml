import { MobileLayout } from '../components/MobileLayout'
import { Card } from '../../shared/components/Card'
import { useFetch } from '../../shared/hooks/useFetch'
import { WELLNESS } from '../../shared/charts/wellness-labels'
import styles from './VitalsPage.module.css'

function fmtN(n, u = '') {
  if (n == null) return '–'
  return String(n).replace('.', ',') + (u ? ' ' + u : '')
}

function colorHrv(v) { return v == null ? '' : v >= 75 ? styles.green : v >= 60 ? styles.yellow : styles.red }
function colorRhr(v) { return v == null ? '' : v <= 50 ? styles.green : v <= 58 ? styles.yellow : styles.red }
function colorSleep(v) { return v == null ? '' : v >= 7.5 ? styles.green : v >= 6 ? styles.yellow : styles.red }
function colorSteps(v) { return v == null ? '' : v >= 8000 ? styles.green : v >= 5000 ? styles.yellow : styles.red }
function colorSpo2(v) { return v == null ? '' : v >= 97 ? styles.green : v >= 95 ? styles.yellow : styles.red }
function colorVo2(v) { return v == null ? '' : v >= 56 ? styles.green : v >= 53 ? styles.yellow : styles.red }

function fmtSteps(s) {
  if (s == null) return '–'
  return s >= 1000 ? (s / 1000).toFixed(1).replace('.', ',') + ' k' : String(s)
}

function MetricItem({ label, value, unit, colorClass, sub }) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={`${styles.metricValue} ${colorClass || ''}`}>
        {value}
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
      {sub && <div className={styles.metricSub}>{sub}</div>}
    </div>
  )
}

function SubjItem({ field, value }) {
  if (value == null) return null
  const cls = [styles.subj1, styles.subj2, styles.subj3, styles.subj4][value - 1]
  const label = WELLNESS[field]?.labels[value - 1] ?? '–'
  return (
    <div className={`${styles.subjItem} ${cls}`}>
      <div className={styles.subjLabel}>{WELLNESS[field]?.name}</div>
      <div className={styles.subjValue}>{label}</div>
    </div>
  )
}

export function VitalsPage({ desktop = false }) {
  const { data, loading, error } = useFetch('/api/get-coach')

  let content
  if (loading) {
    content = (
      <>
        <div className={`${styles.skeleton} ${styles.skelCard}`} />
        <div className={`${styles.skeleton} ${styles.skelCard}`} />
        <div className={`${styles.skeleton} ${styles.skelCard}`} />
      </>
    )
  } else if (error) {
    content = <div className={styles.errCard}>Could not load data: {error}</div>
  } else {
    const { latest, healthMarkers, yesterdayWellness } = data
    const hm = healthMarkers ?? {}
    const yw = yesterdayWellness ?? {}

    content = (
      <>
        <div className={styles.sectionHeader}>HRV & Sleep</div>
        <Card>
          <div className={styles.grid}>
            <MetricItem label="Night HRV" value={fmtN(latest.hrv)} unit="ms" colorClass={colorHrv(latest.hrv)} />
            <MetricItem label="Resting HR" value={fmtN(latest.restingHR)} unit="bpm" colorClass={colorRhr(latest.restingHR)} />
            <MetricItem label="Sleep" value={fmtN(latest.sleepHours)} unit="h" colorClass={colorSleep(latest.sleepHours)} />
            <MetricItem label="Sleep score" value={fmtN(latest.sleepScore)} colorClass={colorSleep(latest.sleepScore ? latest.sleepScore / 10 : null)} />
          </div>
        </Card>

        <div className={styles.sectionHeader}>Health markers</div>
        <Card>
          <div className={styles.grid}>
            <MetricItem label="HRV (SDNN)" value={fmtN(hm.sdnn)} unit="ms" colorClass={colorHrv(hm.sdnn)} sub="Heart rate variability" />
            <MetricItem label="Steps" value={fmtSteps(hm.steps)} colorClass={colorSteps(hm.steps)} sub={hm.steps != null ? (hm.steps >= 8000 ? 'Above avg' : 'Below avg') : 'No data'} />
            <MetricItem label="SpO₂" value={fmtN(hm.spo2)} unit="%" colorClass={colorSpo2(hm.spo2)} sub="Blood oxygen" />
            <MetricItem label="VO₂ max" value={fmtN(hm.vo2max)} unit="ml/kg" colorClass={colorVo2(hm.vo2max)} sub="Aerobic capacity" />
          </div>
        </Card>

        {Object.keys(yw).length > 0 && (
          <>
            <div className={styles.sectionHeader}>Yesterday's wellness</div>
            <Card>
              <div className={styles.subjGrid}>
                {Object.keys(WELLNESS).map(f => yw[f] != null ? <SubjItem key={f} field={f} value={yw[f]} /> : null)}
              </div>
              {yw.notes && <div className={styles.notes}>{yw.notes}</div>}
            </Card>
          </>
        )}
      </>
    )
  }

  if (desktop) return content
  return <MobileLayout title="Vitals">{content}</MobileLayout>
}
