import { useRef, useEffect } from 'react'
import { MobileLayout } from '../components/MobileLayout'
import { Card } from '../../shared/components/Card'
import { useSportLoad } from '../../shared/hooks/useSportLoad'
import { trendGraph, rpeHrScatter } from '../../shared/charts/charts'
import styles from './DataPage.module.css'

export function DataPage({ desktop = false }) {
  const { data, loading, error } = useSportLoad()
  const trendRef = useRef(null)
  const scatterRef = useRef(null)

  useEffect(() => {
    if (!data || !trendRef.current) return
    trendRef.current.innerHTML = ''
    try { trendGraph(trendRef.current, data.sessions ?? []) } catch {}
  }, [data])

  useEffect(() => {
    if (!data || !scatterRef.current) return
    scatterRef.current.innerHTML = ''
    try { rpeHrScatter(scatterRef.current, data.sessions ?? []) } catch {}
  }, [data])

  const content = loading ? (
    <>
      <div className={`${styles.skeleton} ${styles.skelCard}`} />
      <div className={`${styles.skeleton} ${styles.skelCard}`} />
    </>
  ) : error ? (
    <div className={styles.errCard}>Could not load data: {error}</div>
  ) : (
    <>
      <Card title="Training load trend">
        <div ref={trendRef} className={styles.chartContainer} />
      </Card>
      <Card title="RPE vs Heart rate">
        <div ref={scatterRef} className={styles.chartContainer} />
      </Card>
    </>
  )

  if (desktop) return content
  return <MobileLayout title="Data">{content}</MobileLayout>
}
