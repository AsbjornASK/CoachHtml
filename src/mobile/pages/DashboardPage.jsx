import { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MobileLayout } from '../components/MobileLayout'
import { Card } from '../../shared/components/Card'
import { EmptyState } from '../../shared/components/EmptyState'
import { useDashboard } from '../../shared/hooks/useDashboard'
import {
  hrvCalStressChart,
  hrvCheckinChart,
  sleepMoodChart,
  partnerCompare,
  trendGraph,
  vo2Summary,
  lastDays,
  fmtN,
} from '../../shared/charts/charts'
import styles from './DashboardPage.module.css'

const WEEK_DAYS = 7          // swimlane on a phone: one column per day stays readable
const WEEK_DAYS_WIDE = 10    // swimlane on desktop
const TREND_DAYS = 14
const PARTNER_DAYS = 21
const WEIGHT_WINDOW = 21
const VO2_WINDOW = 30

// Phone-width chart geometry: drawn close to 1:1 so axis text stays ~11px
const PHONE_TL = { W: 340, PDL: 40, PDR: 10, compact: true }

const mean = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null
const valuesOf = (days, key) => days.map(d => d[key]).filter(v => v != null)

// Headline value, its distance from the 4-week norm before this week, and a sparkline.
function buildStat(series, today, key, { latest = false, sparkDays = 14 } = {}) {
  const baseline = mean(valuesOf(lastDays(series, today, 35).slice(0, 28), key))
  const value = latest
    ? ([...series].reverse().find(d => d[key] != null)?.[key] ?? null)
    : mean(valuesOf(lastDays(series, today, 7), key))
  return {
    value,
    delta: value != null && baseline != null ? value - baseline : null,
    spark: lastDays(series, today, sparkDays).map(d => d[key] ?? null),
  }
}

function Spark({ values }) {
  const pts = values.map((v, i) => (v != null ? { i, v } : null)).filter(Boolean)
  if (pts.length < 2) return <div className={styles.spark} />
  const vs = pts.map(p => p.v)
  const mn = Math.min(...vs), rng = (Math.max(...vs) - mn) || 1
  const W = 100, H = 28, pd = 3
  const x = i => (i / (values.length - 1)) * W
  const y = v => pd + (1 - (v - mn) / rng) * (H - 2 * pd)
  const line = pts.map(p => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const area = `${x(pts[0].i).toFixed(1)},${H} ${line} ${x(pts[pts.length - 1].i).toFixed(1)},${H}`
  return (
    <svg className={styles.spark} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon className={styles.sparkArea} points={area} />
      <polyline className={styles.sparkLine} points={line} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// goodWhen: 'up' | 'down' colours the change; null keeps it neutral (e.g. weight).
function StatTile({ label, unit, dec = 0, stat, goodWhen = null }) {
  const { value, delta, spark } = stat
  const flat = delta == null || Math.abs(delta) < (dec ? 0.05 : 0.5)
  const tone = flat || !goodWhen ? 'Flat' : (delta > 0) === (goodWhen === 'up') ? 'Good' : 'Bad'
  const deltaText = delta == null
    ? 'No norm yet'
    : flat
      ? 'Level with your norm'
      : `${delta > 0 ? '▲' : '▼'} ${fmtN(Math.abs(delta), dec)} ${unit} vs norm`
  return (
    <div className={styles.tile}>
      <div className={styles.tileLabel}>{label}</div>
      <div className={styles.tileValue}>
        {fmtN(value, dec)}
        {value != null && <span className={styles.tileUnit}> {unit}</span>}
      </div>
      <div className={`${styles.tileDelta} ${styles['tileDelta' + tone]}`}>{deltaText}</div>
      <Spark values={spark} />
    </div>
  )
}

function ChartCard({ title, sub, html }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html ?? ''
  }, [html])
  return (
    <Card>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>{title}</div>
        {sub && <div className={styles.cardSub}>{sub}</div>}
      </div>
      <div ref={ref} className={styles.chartContainer} />
    </Card>
  )
}

function SectionHeader({ children }) {
  return <div className={styles.sectionHeader}>{children}</div>
}

export function DashboardPage({ desktop = false }) {
  const { data: dashData, loading, error, refetch } = useDashboard()

  let content
  if (loading) {
    content = (
      <>
        <div className={`${styles.skeleton} ${styles.skelTiles}`} />
        <div className={`${styles.skeleton} ${styles.skelCard}`} />
        <div className={`${styles.skeleton} ${styles.skelCard}`} />
      </>
    )
  } else if (error) {
    content = <Card><EmptyState body="Configure your Intervals.icu API credentials to view your dashboard." /></Card>
  } else if (!dashData?.series?.length) {
    content = <Card><EmptyState icon="📭" title="No data" body="No dashboard data available yet." /></Card>
  } else {
    const series = dashData.series
    const today = dashData.today ?? new Date().toISOString().slice(0, 10)
    const bands = dashData.hrvBands

    const week = lastDays(series, today, desktop ? WEEK_DAYS_WIDE : WEEK_DAYS)
    const trend = lastDays(series, today, TREND_DAYS)
    const partnerDays = lastDays(series, today, PARTNER_DAYS)

    const weekHtml = hrvCalStressChart(week, series, bands, desktop ? 1024 : 375)
    const hrvHtml = hrvCheckinChart(trend, PHONE_TL)
    const sleepHtml = sleepMoodChart(trend, PHONE_TL)
    const partnerHtml = partnerCompare(series, partnerDays, desktop ? undefined : PHONE_TL)
    const weightHtml = trendGraph(series, today, { field: 'weight', days: WEIGHT_WINDOW, range: null, W: 340, empty: 'Too few weight entries' })
    const vo2Html = vo2Summary(series, today, VO2_WINDOW) + trendGraph(series, today, { field: 'vo2max', days: VO2_WINDOW, range: null, color: '#007aff', W: 340, empty: 'Too few VO₂ max values' })

    content = (
      <>
        <p className={styles.lede}>Your last 7 days against your 4-week norm.</p>
        <div className={styles.tiles}>
          <StatTile label="Night HRV" unit="ms" stat={buildStat(series, today, 'hrv')} goodWhen="up" />
          <StatTile label="Resting HR" unit="bpm" stat={buildStat(series, today, 'rhr')} goodWhen="down" />
          <StatTile label="Sleep" unit="h" dec={1} stat={buildStat(series, today, 'sleep')} goodWhen="up" />
          <StatTile label="Weight" unit="kg" dec={1} stat={buildStat(series, today, 'weight', { latest: true, sparkDays: 60 })} />
        </div>

        <SectionHeader>This week</SectionHeader>
        <ChartCard
          title="HRV, calendar and stress"
          sub="Night and day HRV, what was on, and how stressed you felt."
          html={weekHtml}
        />

        <SectionHeader>Recovery and sleep</SectionHeader>
        <div className="card-grid">
          <ChartCard title="HRV × Fatigue" sub={`Last ${TREND_DAYS} days. Dot colour is how tired you felt.`} html={hrvHtml} />
          <ChartCard title="Sleep × Mood" sub={`Last ${TREND_DAYS} days. Dot colour is your mood.`} html={sleepHtml} />
        </div>
        <ChartCard title="Partner vs. alone" html={partnerHtml} />

        <SectionHeader>Body</SectionHeader>
        <div className="card-grid">
          <ChartCard title="Weight" sub={`Last ${WEIGHT_WINDOW} days`} html={weightHtml} />
          <ChartCard title="VO₂ max" sub={`Last ${VO2_WINDOW} days`} html={vo2Html} />
        </div>

        <Link to="/data" className={styles.moreLink}>
          All data
          <span className={styles.moreChevron} aria-hidden="true">›</span>
        </Link>
      </>
    )
  }

  if (desktop) return content
  return <MobileLayout title="Dashboard" onRefresh={refetch}>{content}</MobileLayout>
}
