import { useRef, useEffect } from 'react'
import { MobileLayout } from '../components/MobileLayout'
import { Card } from '../../shared/components/Card'
import { useDashboard } from '../../shared/hooks/useDashboard'
import { useSportLoad } from '../../shared/hooks/useSportLoad'
import { hrvCheckinChart, sleepMoodChart, zoneWeeksChart } from '../../shared/charts/charts'
import styles from './DashboardPage.module.css'

function ChartCard({ title, chartRef }) {
  return (
    <Card title={title}>
      <div ref={chartRef} className={styles.chartContainer} />
    </Card>
  )
}

function SkeletonCards() {
  return (
    <>
      <div className={`${styles.skeleton} ${styles.skelCard}`} />
      <div className={`${styles.skeleton} ${styles.skelCard}`} />
      <div className={`${styles.skeleton} ${styles.skelCard}`} />
    </>
  )
}

export function DashboardPage({ desktop = false }) {
  const { data: dashData, loading: dashLoading, error: dashError } = useDashboard()
  const { data: loadData, loading: loadLoading, error: loadError } = useSportLoad()

  const hrvRef = useRef(null)
  const sleepRef = useRef(null)
  const zonesRef = useRef(null)

  useEffect(() => {
    if (!dashData || !hrvRef.current) return
    hrvRef.current.innerHTML = ''
    try { hrvCheckinChart(hrvRef.current, dashData.series ?? []) } catch {}
  }, [dashData])

  useEffect(() => {
    if (!dashData || !sleepRef.current) return
    sleepRef.current.innerHTML = ''
    try { sleepMoodChart(sleepRef.current, dashData.series ?? []) } catch {}
  }, [dashData])

  useEffect(() => {
    if (!loadData || !zonesRef.current) return
    zonesRef.current.innerHTML = ''
    try { zoneWeeksChart(zonesRef.current, loadData.sessions ?? []) } catch {}
  }, [loadData])

  const loading = dashLoading || loadLoading
  const error = dashError || loadError

  const content = loading ? (
    <SkeletonCards />
  ) : error ? (
    <div className={styles.errCard}>Could not load data: {error}</div>
  ) : (
    <>
      <ChartCard title="HRV & Check-in" chartRef={hrvRef} />
      <ChartCard title="Sleep & Mood" chartRef={sleepRef} />
      <ChartCard title="Zone weeks" chartRef={zonesRef} />
    </>
  )

  if (desktop) return content
  return <MobileLayout title="Dashboard">{content}</MobileLayout>
}
