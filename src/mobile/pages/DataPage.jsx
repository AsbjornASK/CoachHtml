import { useState, useRef, useEffect } from 'react'
import { MobileLayout } from '../components/MobileLayout'
import { Card } from '../../shared/components/Card'
import { EmptyState } from '../../shared/components/EmptyState'
import { useDashboard } from '../../shared/hooks/useDashboard'
import { useSportLoad } from '../../shared/hooks/useSportLoad'
import {
  fitnessCheckinChart,
  sportFitnessChart,
  tsbMoodScatter,
  sleepMoodScatter,
  checkinTable,
  computeInsights,
  calendarLoadChart,
  hrvCalStressChart,
  hrvCheckinChart,
  sleepMoodChart,
  partnerCompare,
  trendGraph,
  vo2Summary,
  loadHrvChart,
  rpeHrScatter,
  zoneWeeksChart,
  lastDays,
  fmtN,
} from '../../shared/charts/charts'
import styles from './DataPage.module.css'

const DATA_TABS = ['recovery', 'training', 'sessions', 'body', 'life', 'patterns']
const TAB_LABELS = {
  recovery: 'Recovery',
  training: 'Training',
  sessions: 'Sessions',
  body: 'Body',
  life: 'Life',
  patterns: 'Patterns',
}

function getStoredTab() {
  try { return localStorage.getItem('dataTab') || 'recovery' } catch { return 'recovery' }
}

function HtmlCard({ title, subtitle, html }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html ?? ''
  }, [html])
  return (
    <Card title={title}>
      {subtitle && <div className={styles.cardSubtitle}>{subtitle}</div>}
      <div ref={ref} className={styles.chartContainer} />
    </Card>
  )
}

function KpiTile({ title, value, unit, sub, color }) {
  return (
    <div className={styles.kpiTile}>
      <div className={styles.kpiTitle}>{title}</div>
      <div className={`${styles.kpiValue} ${styles[color] || ''}`}>
        {value}<span className={styles.kpiUnit}>{unit}</span>
      </div>
      <div className={styles.kpiSub}>{sub}</div>
    </div>
  )
}

function tsbLabel(t) {
  if (t == null) return 'No data'
  if (t > 10) return 'Tapered'
  if (t > 5) return 'Peak form'
  if (t >= -5) return 'Maintenance'
  if (t >= -10) return 'Build phase'
  if (t >= -20) return 'Accum. fatigue'
  return 'Overreaching'
}

function kpiColor(v) {
  return v == null ? '' : v >= 65 ? 'green' : v >= 45 ? 'yellow' : 'red'
}

const SPORT_LABELS = { all: 'All', run: 'Run', ride: 'Bike', strength: 'Strength' }
const FILTER_SPORTS = ['all', 'run', 'ride', 'strength']

function SportFilter({ sessions, activeSport, onSelect }) {
  const present = new Set(sessions.map(s => s.sport).filter(Boolean))
  const available = FILTER_SPORTS.filter(k => k === 'all' || present.has(k))
  if (available.length <= 2) return null
  return (
    <div className={styles.sportFilter}>
      {available.map(k => (
        <button
          key={k}
          className={`${styles.sportBtn} ${activeSport === k ? styles.sportBtnActive : ''}`}
          onClick={() => onSelect(k)}
        >
          {SPORT_LABELS[k]}
        </button>
      ))}
    </div>
  )
}

export function DataPage({ desktop = false }) {
  const [activeTab, setActiveTab] = useState(getStoredTab)
  const [sportFilter, setSportFilter] = useState('all')
  const { data: dashData, loading: dashLoading, error: dashError, refetch: refetchDash } = useDashboard()
  const { data: loadData, loading: loadLoading, error: loadError } = useSportLoad()

  const selectTab = (t) => {
    setActiveTab(t)
    try { localStorage.setItem('dataTab', t) } catch {}
  }

  const loading = dashLoading || loadLoading
  const error = dashError || loadError

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
    content = <Card><EmptyState body="Configure your Intervals.icu API credentials to view your data." /></Card>
  } else {
    const series = dashData?.series ?? []
    const today = dashData?.today ?? new Date().toISOString().slice(0, 10)
    const bands = dashData?.hrvBands
    const sportSeries = loadData?.series ?? []
    const sessions = loadData?.sessions ?? []

    const t30 = lastDays(series, today, 30)
    const t14 = lastDays(series, today, 14)
    const t21 = lastDays(series, today, 21)

    const latest = [...series].reverse().find(d => d.ctl != null) ?? series[series.length - 1] ?? {}

    const tabs = (
      <div className={styles.tabs}>
        {DATA_TABS.map(t => (
          <button
            key={t}
            className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`}
            onClick={() => selectTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
    )

    const recoveryPanel = activeTab === 'recovery' && (
      <>
        <HtmlCard title="HRV · Calendar · Stress" html={hrvCalStressChart(t14, series, bands)} />
        <HtmlCard title="HRV × Fatigue" html={hrvCheckinChart(t30)} />
        <HtmlCard title="Sleep × Mood" html={sleepMoodChart(t30)} />
        <HtmlCard title="Partner vs. alone" html={partnerCompare(series, t30)} />
      </>
    )

    const trainingPanel = activeTab === 'training' && (
      <>
        <div className={styles.kpiRow}>
          <KpiTile title="Fitness (CTL)" value={fmtN(latest.ctl)} unit="" sub="60-day avg" color="blue" />
          <KpiTile title="Fatigue (ATL)" value={fmtN(latest.atl)} unit="" sub="7-day avg" color="yellow" />
          <KpiTile title="Form (TSB)" value={fmtN(latest.tsb, 1)} unit="" sub={tsbLabel(latest.tsb)} color={latest.tsb != null && latest.tsb >= 0 ? 'green' : 'yellow'} />
          <KpiTile title="HRV" value={fmtN(latest.hrv)} unit="ms" sub="Latest" color={kpiColor(latest.hrv)} />
        </div>
        <HtmlCard title="Fitness & Form: 30 days" subtitle="Dots = day's check-in mood" html={fitnessCheckinChart(series.slice(-31))} />
        <HtmlCard title="Run: Fitness & Form" html={sportFitnessChart(sportSeries.map(d => ({ date: d.date, ...d.run })))} />
        <HtmlCard title="Strength: Fitness & Form" html={sportFitnessChart(sportSeries.map(d => ({ date: d.date, ...d.strength })))} />
      </>
    )

    const sessionsPanel = activeTab === 'sessions' && (
      <>
        <SportFilter sessions={sessions} activeSport={sportFilter} onSelect={setSportFilter} />
        <HtmlCard
          title="Load × Day HRV"
          subtitle="Training load per day by sport; dots = Day HRV the next morning against your 42-day norm"
          html={loadHrvChart(t30, sessions, series, undefined, sportFilter)}
        />
        <HtmlCard
          title="RPE × heart rate"
          subtitle="Sessions from the last 150 days"
          html={rpeHrScatter(sessions, undefined, sportFilter)}
        />
        <HtmlCard title="Heart-rate zones per week" html={zoneWeeksChart(sessions, today, 12, undefined, sportFilter)} />
      </>
    )

    const bodyPanel = activeTab === 'body' && (
      <>
        <HtmlCard title="Weight over time" html={trendGraph(series, today, { field: 'weight', days: 90, range: null, W: 440, empty: 'Too few weight entries' })} />
        <HtmlCard title="VO₂ max over time" html={vo2Summary(series, today, 90) + trendGraph(series, today, { field: 'vo2max', days: 90, range: null, color: '#007aff', W: 440, empty: 'Too few VO₂ max values' })} />
      </>
    )

    const lifePanel = activeTab === 'life' && (
      <HtmlCard
        title="Calendar load & SDNN recovery"
        subtitle="Bars = number of events per category; black dots = SDNN next morning"
        html={calendarLoadChart(series)}
      />
    )

    const patternsPanel = activeTab === 'patterns' && (
      <>
        <HtmlCard title="Insights" html={computeInsights(series)} />
        <div className={styles.row2}>
          <HtmlCard title="Check-in history: last 21 days" html={checkinTable(series)} />
          <div>
            <HtmlCard title="TSB vs Mood" html={tsbMoodScatter(series)} />
            <HtmlCard title="Sleep vs Mood" html={sleepMoodScatter(series)} />
          </div>
        </div>
      </>
    )

    content = (
      <>
        {tabs}
        {recoveryPanel}
        {trainingPanel}
        {sessionsPanel}
        {bodyPanel}
        {lifePanel}
        {patternsPanel}
      </>
    )
  }

  if (desktop) return <div className={styles.desktopWrap}>{content}</div>
  return <MobileLayout title="Data" onRefresh={refetchDash}>{content}</MobileLayout>
}
