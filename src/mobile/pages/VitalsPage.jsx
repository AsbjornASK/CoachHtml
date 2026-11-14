import { MobileLayout } from '../components/MobileLayout'
import { Card } from '../../shared/components/Card'
import { useFetch } from '../../shared/hooks/useFetch'
import { WELLNESS } from '../../shared/charts/wellness-labels'
import styles from './VitalsPage.module.css'

function fmtN(n, u = '') {
  if (n == null) return '–'
  return String(n).replace('.', ',') + (u ? ' ' + u : '')
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

function colorHrv(v)   { return v == null ? '' : v >= 75 ? styles.green : v >= 60 ? styles.yellow : styles.red }
function colorRhr(v)   { return v == null ? '' : v <= 50 ? styles.green : v <= 58 ? styles.yellow : styles.red }
function colorSleep(v) { return v == null ? '' : v >= 7.5 ? styles.green : v >= 6 ? styles.yellow : styles.red }
function colorSteps(v) { return v == null ? '' : v >= 8000 ? styles.green : v >= 5000 ? styles.yellow : styles.red }
function colorSpo2(v)  { return v == null ? '' : v >= 97 ? styles.green : v >= 95 ? styles.yellow : styles.red }
function colorVo2(v)   { return v == null ? '' : v >= 56 ? styles.green : v >= 53 ? styles.yellow : styles.red }

function fmtSteps(s) {
  if (s == null) return '–'
  return s >= 1000 ? (s / 1000).toFixed(1).replace('.', ',') + ' k' : String(s)
}

function trendDir(arr, invert = false) {
  const v = arr.filter(x => x != null)
  if (v.length < 4) return { a: '→', c: 'flat' }
  const r = v.slice(-3).reduce((a, b) => a + b, 0) / 3
  const o = v.slice(0, -3).reduce((a, b) => a + b, 0) / Math.max(1, v.length - 3)
  const d = r - o
  if (Math.abs(d) < o * 0.02) return { a: '→', c: 'flat' }
  const up = d > 0
  const good = invert ? !up : up
  return { a: up ? '↑' : '↓', c: good ? 'up' : 'down' }
}

function Sparkline({ values, colorFn }) {
  const pts = (values ?? []).map((v, i) => v != null ? { x: i, v } : null).filter(Boolean)
  if (pts.length < 2) return null
  const vs = pts.map(p => p.v)
  const mn = Math.min(...vs), mx = Math.max(...vs), rng = mx - mn || 1
  const W = 56, H = 24, pd = 2
  const px = i => pd + i * (W - 2 * pd) / (values.length - 1)
  const py = v => H - pd - ((v - mn) / rng) * (H - 2 * pd)
  const pts2 = pts.map(p => `${px(p.x).toFixed(1)},${py(p.v).toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  const color = colorFn ? colorFn(last.v) : '#007aff'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className={styles.sparkline}>
      <polyline fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" points={pts2} />
      <circle cx={px(last.x)} cy={py(last.v)} r={2.5} fill={color} />
    </svg>
  )
}

function MetricItem({ label, value, unit, colorClass, sub, sparkValues, sparkColorFn, trend }) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={`${styles.metricValue} ${colorClass || ''}`}>
        {value}
        {unit && <span className={styles.unit}>{unit}</span>}
        {trend && <span className={trend.c === 'up' ? styles.trendUp : trend.c === 'down' ? styles.trendDown : styles.trendFlat}>{trend.a}</span>}
      </div>
      {sub && <div className={styles.metricSub}>{sub}</div>}
      {sparkValues && <Sparkline values={sparkValues} colorFn={sparkColorFn} />}
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

function BodyCompItem({ label, value, unit, delta }) {
  const sign = delta > 0 ? '+' : ''
  const dColor = delta == null ? '' : delta <= 0 ? styles.green : styles.red
  return (
    <div className={styles.metric}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>
        {fmtN(value)}{unit && <span className={styles.unit}>{unit}</span>}
      </div>
      {delta != null && (
        <div className={`${styles.metricSub} ${dColor}`}>{sign}{fmtN(delta)}</div>
      )}
    </div>
  )
}

export function VitalsPage({ desktop = false }) {
  const { data, loading, error } = useFetch('/api/get-vitals')

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
    const { latest, trends, healthMarkers, yesterdayWellness, inBody } = data
    const hm = healthMarkers ?? {}
    const yw = yesterdayWellness ?? {}

    const hrv_t = trendDir(trends.hrv)
    const rhr_t = trendDir(trends.rhr, true)
    const slp_t = trendDir(trends.sleep)

    const colorHrvFn = v => v >= 75 ? '#30d158' : v >= 60 ? '#ff9f0a' : '#ff3b30'
    const colorRhrFn = v => v <= 50 ? '#30d158' : v <= 58 ? '#ff9f0a' : '#ff3b30'
    const colorSleepFn = v => v >= 7.5 ? '#30d158' : v >= 6 ? '#ff9f0a' : '#ff3b30'

    const ywFields = ['mood', 'soreness', 'fatigue', 'motivation', 'stress', 'sleepQuality']

    content = (
      <>
        <div className={styles.sectionHeader}>Yesterday{yw.date ? ` · ${fmtDate(yw.date)}` : ''}</div>
        <Card>
          <div className={styles.grid}>
            <MetricItem label="Night HRV" value={fmtN(latest.hrv)} unit="ms" colorClass={colorHrv(latest.hrv)} sparkValues={trends.hrv} sparkColorFn={colorHrvFn} trend={hrv_t} />
            <MetricItem label="Resting HR" value={fmtN(latest.restingHR)} unit="bpm" colorClass={colorRhr(latest.restingHR)} sparkValues={trends.rhr} sparkColorFn={colorRhrFn} trend={rhr_t} />
            <MetricItem label="Sleep" value={fmtN(latest.sleepHours)} unit="h" colorClass={colorSleep(latest.sleepHours)} sparkValues={trends.sleep} sparkColorFn={colorSleepFn} trend={slp_t} />
            <MetricItem label="Sleep score" value={fmtN(latest.sleepScore)} colorClass={colorSleep(latest.sleepScore ? latest.sleepScore / 10 : null)} sparkValues={trends.sleepScore} />
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

        {ywFields.some(f => yw[f] != null) && (
          <>
            <div className={styles.sectionHeader}>Yesterday's wellness</div>
            <Card>
              <div className={styles.subjGrid}>
                {ywFields.map(f => yw[f] != null ? <SubjItem key={f} field={f} value={yw[f]} /> : null)}
              </div>
              {yw.comments && <div className={styles.notes}>{yw.comments}</div>}
            </Card>
          </>
        )}

        {inBody && (
          <>
            <div className={styles.sectionHeader}>Body composition</div>
            <Card>
              <div className={styles.grid}>
                <BodyCompItem label="Weight" value={inBody.weight} unit="kg" delta={inBody.prev ? inBody.weight - inBody.prev.weight : null} />
                <BodyCompItem label="Fat %" value={inBody.fatPct} unit="%" delta={inBody.prev ? inBody.fatPct - inBody.prev.fatPct : null} />
                <BodyCompItem label="Fat mass" value={inBody.fatMass} unit="kg" delta={inBody.prev ? inBody.fatMass - inBody.prev.fatMass : null} />
                <BodyCompItem label="BMI" value={inBody.bmi} delta={inBody.prev ? inBody.bmi - inBody.prev.bmi : null} />
              </div>
              {inBody.date && <div className={styles.metricSub} style={{ marginTop: 10 }}>Measured {fmtDate(inBody.date)}</div>}
            </Card>
          </>
        )}
      </>
    )
  }

  if (desktop) return content
  return <MobileLayout title="Vitals">{content}</MobileLayout>
}
