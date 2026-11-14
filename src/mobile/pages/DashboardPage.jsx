import { useRef, useEffect } from 'react'
import { MobileLayout } from '../components/MobileLayout'
import { Card } from '../../shared/components/Card'
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
} from '../../shared/charts/charts'
import styles from './DashboardPage.module.css'

const TIMELINE_DAYS = 10
const WEIGHT_WINDOW = 21
const VO2_WINDOW = 30

function HtmlCard({ title, html }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html ?? ''
  }, [html])
  return (
    <Card title={title}>
      <div ref={ref} className={styles.chartContainer} />
    </Card>
  )
}

export function DashboardPage({ desktop = false }) {
  const { data: dashData, loading, error } = useDashboard()
  const { data: loadData } = useSportLoad()

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
        <HtmlCard title="HRV · Calendar · Stress" html={hrvCalHtml} />
        <HtmlCard title="HRV × Fatigue" html={hrvHtml} />
        <HtmlCard title="Sleep × Mood" html={sleepHtml} />
        <HtmlCard title="Partner vs. alone" html={partnerHtml} />
        <HtmlCard title="Weight over time" html={weightHtml} />
        <HtmlCard title="VO₂ max over time" html={vo2Html} />
      </>
    )
  }

  if (desktop) return content
  return <MobileLayout title="Dashboard">{content}</MobileLayout>
}
