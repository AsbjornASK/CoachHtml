import { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MobileLayout } from '../components/MobileLayout'
import { Card } from '../../shared/components/Card'
import { EmptyState } from '../../shared/components/EmptyState'
import { useDashboard } from '../../shared/hooks/useDashboard'
import { useSportLoad } from '../../shared/hooks/useSportLoad'
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

const TIMELINE_DAYS = 10
const WEIGHT_WINDOW = 21
const VO2_WINDOW = 30

function HtmlCard({ title, html, badge, badgeVariant = 'neutral' }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html ?? ''
  }, [html])
  return (
    <Card>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>{title}</span>
        {badge && <span className={`${styles.badge} ${styles['badge' + badgeVariant]}`}>{badge}</span>}
      </div>
      <div ref={ref} className={styles.chartContainer} />
    </Card>
  )
}

function SummaryStrip({ series, today }) {
  const recent = series ? [...series].reverse().find(d => d.hrv != null) : null
  const recentSleep = series ? [...series].reverse().find(d => d.sleepSecs != null || d.sleepHours != null) : null
  const recentVo2 = series ? [...series].reverse().find(d => d.vo2max != null || d.vo2Max != null) : null

  const hrv = recent?.hrv ?? null
  const sleep = recentSleep ? (recentSleep.sleepSecs != null ? recentSleep.sleepSecs / 3600 : recentSleep.sleepHours) : null
  const vo2 = recentVo2 ? (recentVo2.vo2max ?? recentVo2.vo2Max) : null

  return (
    <div className={styles.summaryStrip}>
      <div className={styles.statCell}>
        <span className={styles.statVal}>{hrv != null ? Math.round(hrv) : '–'}<span className={styles.statUnit}> ms</span></span>
        <span className={styles.statLabel}>HRV</span>
      </div>
      <div className={styles.statCell}>
        <span className={styles.statVal}>{sleep != null ? sleep.toFixed(1).replace('.', ',') : '–'}<span className={styles.statUnit}> h</span></span>
        <span className={styles.statLabel}>Sleep</span>
      </div>
      <div className={styles.statCell}>
        <span className={styles.statVal}>{vo2 != null ? fmtN(vo2, 1) : '–'}</span>
        <span className={styles.statLabel}>VO₂ max</span>
      </div>
    </div>
  )
}

function SectionHeader({ children }) {
  return <div className={styles.sectionHeader}>{children}</div>
}

export function DashboardPage({ desktop = false }) {
  const { data: dashData, loading, error, refetch } = useDashboard()
  const { data: loadData } = useSportLoad()

  let content
  if (loading) {
    content = (
      <>
        <div className={`${styles.skeleton} ${styles.skelStrip}`} />
        <div className={`${styles.skeleton} ${styles.skelCard}`} />
        <div className={`${styles.skeleton} ${styles.skelCard}`} />
        <div className={`${styles.skeleton} ${styles.skelCard}`} />
      </>
    )
  } else if (error) {
    content = <Card><EmptyState body="Configure your Intervals.icu API credentials to view your dashboard." /></Card>
  } else {
    const series = dashData?.series ?? []
    const today = dashData?.today ?? new Date().toISOString().slice(0, 10)
    const bands = dashData?.hrvBands

    const tl10 = lastDays(series, today, TIMELINE_DAYS)
    const tl21 = lastDays(series, today, WEIGHT_WINDOW)

    const hrvCalHtml = hrvCalStressChart(tl10, series, bands)
    const hrvHtml = hrvCheckinChart(tl21)
    const sleepHtml = sleepMoodChart(tl21)
    const partnerHtml = partnerCompare(series, tl21)
    const weightHtml = trendGraph(series, today, { field: 'weight', days: WEIGHT_WINDOW, range: null, W: 320, empty: 'Too few weight entries' })
    const vo2Html = vo2Summary(series, today, VO2_WINDOW) + trendGraph(series, today, { field: 'vo2max', days: VO2_WINDOW, range: null, color: '#007aff', W: 320, empty: 'Too few VO₂ max values' })

    content = (
      <>
        <SummaryStrip series={series} today={today} />

        <SectionHeader>Recovery</SectionHeader>
        <div className="card-grid">
          <HtmlCard title="HRV · Calendar · Stress" html={hrvCalHtml} />
          <HtmlCard title="HRV × Fatigue" html={hrvHtml} />
        </div>

        <SectionHeader>Sleep & mood</SectionHeader>
        <HtmlCard title="Sleep × Mood" html={sleepHtml} />

        <SectionHeader>Training</SectionHeader>
        <HtmlCard title="Partner vs. alone" html={partnerHtml} />

        <SectionHeader>Body</SectionHeader>
        <div className={styles.bodyRow}>
          <Card>
            <div className={styles.cardHead}><span className={styles.cardTitle}>Weight</span></div>
            <div className={styles.chartContainer} dangerouslySetInnerHTML={{ __html: weightHtml }} />
          </Card>
          <Card>
            <div className={styles.cardHead}><span className={styles.cardTitle}>VO₂ max</span></div>
            <div className={styles.chartContainer} dangerouslySetInnerHTML={{ __html: vo2Html }} />
          </Card>
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
