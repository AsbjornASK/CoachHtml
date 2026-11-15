import { useState } from 'react'
import { MobileLayout } from '../components/MobileLayout'
import { Card } from '../../shared/components/Card'
import { useFetch } from '../../shared/hooks/useFetch'
import { WELLNESS, WELLNESS_COLORS } from '../../shared/charts/wellness-labels'
import styles from './VitalsPage.module.css'

function fmtN(n) {
  if (n == null) return '–'
  return String(n).replace('.', ',')
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

function fmtDateShort(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  return `${d.getDate()}/${d.getMonth() + 1}`
}

function colorHrv(v)   { return v == null ? '' : v >= 75 ? styles.green : v >= 60 ? styles.yellow : styles.red }
function colorRhr(v)   { return v == null ? '' : v <= 50 ? styles.green : v <= 58 ? styles.yellow : styles.red }
function colorSleep(v) { return v == null ? '' : v >= 7.5 ? styles.green : v >= 6 ? styles.yellow : styles.red }
function colorSteps(v) { return v == null ? '' : v >= 8000 ? styles.green : v >= 5000 ? styles.yellow : styles.red }
function colorSpo2(v)  { return v == null ? '' : v >= 97 ? styles.green : v >= 95 ? styles.yellow : styles.red }
function colorVo2(v)   { return v == null ? '' : v >= 56 ? styles.green : v >= 53 ? styles.yellow : styles.red }

function fmtSteps(s) {
  if (s == null) return '–'
  return s >= 1000 ? (s / 1000).toFixed(1).replace('.', ',') + 'k' : String(s)
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

function deltaBadgeFor(current, prev, unit = '', invertGood = false) {
  if (current == null || prev == null) return null
  const diff = current - prev
  if (Math.abs(diff) < 0.05) return null
  const up = diff > 0
  const good = invertGood ? !up : up
  const sign = diff > 0 ? '+' : ''
  const val = Math.round(Math.abs(diff) * 10) / 10
  return {
    text: `${up ? '↑' : '↓'} ${sign}${fmtN(val)}${unit ? ' ' + unit : ''}`,
    cls: `${styles.deltaBadge} ${good ? styles.deltaBadgeGood : styles.deltaBadgeBad}`,
  }
}

function Sparkline({ values, colorFn }) {
  const pts = (values ?? []).map((v, i) => v != null ? { x: i, v } : null).filter(Boolean)
  if (pts.length < 2) return null
  const vs = pts.map(p => p.v)
  const mn = Math.min(...vs), mx = Math.max(...vs), rng = mx - mn || 1
  const W = 90, H = 24, pd = 2
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

function BarSparkline({ values, colorFn }) {
  if (!values || values.length === 0) return null
  const max = Math.max(...values.filter(v => v != null), 1)
  return (
    <div className={styles.barSparkline}>
      {values.map((v, i) => {
        const h = v != null ? Math.max(3, Math.round((v / max) * 20)) : 2
        const bg = v == null ? '#c7c7cc' : (colorFn ? colorFn(v) : '#007aff')
        return <div key={i} className={styles.barSparklineBar} style={{ height: h + 'px', background: bg }} />
      })}
    </div>
  )
}

function DotTimeline({ values }) {
  if (!values || values.length === 0) return null
  return (
    <div className={styles.dotTimeline}>
      {values.map((v, i) => {
        const isLast = i === values.length - 1
        const bg = v == null ? '#c7c7cc' : WELLNESS_COLORS[v - 1] ?? '#c7c7cc'
        return (
          <div
            key={i}
            className={`${styles.dot} ${isLast ? styles.dotLast : ''}`}
            style={{ background: bg }}
          />
        )
      })}
    </div>
  )
}

function MetricRow({ label, labelDate, value, unit, colorClass, sparkValues, sparkColorFn, trend, badge, barValues, barColorFn }) {
  return (
    <div className={styles.metricRow}>
      <div className={styles.metricRowLabel}>
        {label}
        {labelDate && <span className={styles.metricRowDate}>{labelDate}</span>}
      </div>
      <div className={`${styles.metricRowValue} ${colorClass || ''}`}>
        {value}
        {unit && <span className={styles.unit}>{unit}</span>}
        {trend && <span className={trend.c === 'up' ? styles.trendUp : trend.c === 'down' ? styles.trendDown : styles.trendFlat}>{trend.a}</span>}
      </div>
      <div className={styles.metricRowGraph}>
        {badge && <span className={badge.cls}>{badge.text}</span>}
        {!badge && barValues && <BarSparkline values={barValues} colorFn={barColorFn} />}
        {!badge && !barValues && sparkValues && <Sparkline values={sparkValues} colorFn={sparkColorFn} />}
      </div>
    </div>
  )
}

function WellnessRow({ field, value, history }) {
  const info = WELLNESS[field]
  if (!info) return null
  const label = info.labels[value - 1] ?? '–'
  const colorClass = value != null ? [styles.green, styles.yellow, styles.red, styles.purple][value - 1] : ''
  return (
    <div className={styles.metricRow}>
      <div className={styles.metricRowLabel}>{info.name}</div>
      <div className={`${styles.metricRowValue} ${colorClass}`} style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}>
        {value != null ? label : '–'}
      </div>
      <div className={styles.metricRowGraph}>
        <DotTimeline values={history} />
      </div>
    </div>
  )
}

export function VitalsPage({ desktop = false }) {
  const { data, loading, error, refetch } = useFetch('/api/get-vitals')

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
  } else if (!data) {
    content = <div className={styles.errCard}>No data available</div>
  } else {
    const { latest, trends, healthMarkers, yesterdayWellness, inBody, spo2Latest, vo2Latest } = data
    const hm  = healthMarkers ?? {}
    const yw  = yesterdayWellness ?? {}
    const wh  = trends?.wellness ?? {}

    const hrv_t = trendDir(trends.hrv)
    const rhr_t = trendDir(trends.rhr, true)
    const slp_t = trendDir(trends.sleep)

    const colorHrvFn   = v => v >= 75 ? '#30d158' : v >= 60 ? '#ff9f0a' : '#ff3b30'
    const colorRhrFn   = v => v <= 50 ? '#30d158' : v <= 58 ? '#ff9f0a' : '#ff3b30'
    const colorSleepFn = v => v >= 7.5 ? '#30d158' : v >= 6 ? '#ff9f0a' : '#ff3b30'
    const colorStepsFn = v => v >= 8000 ? '#30d158' : v >= 5000 ? '#ff9f0a' : '#ff3b30'

    const spo2Badge = spo2Latest ? deltaBadgeFor(spo2Latest.value, spo2Latest.prev, '%') : null
    const vo2Badge  = vo2Latest  ? deltaBadgeFor(vo2Latest.value,  vo2Latest.prev)       : null

    const wellnessFields = ['soreness', 'fatigue', 'motivation', 'stress']

    content = (
      <>
        <div className={styles.sectionHeader}>Yesterday{yw.date ? ` · ${fmtDate(yw.date)}` : ''}</div>

        <div className={styles.sectionSubtitle}>Night health markers</div>
        <Card>
          <div className={styles.grid1}>
            <MetricRow label="Night HRV" value={fmtN(latest.hrv)} unit="ms" colorClass={colorHrv(latest.hrv)} sparkValues={trends.hrv} sparkColorFn={colorHrvFn} trend={hrv_t} />
            <MetricRow label="Resting HR" value={fmtN(latest.restingHR)} unit="bpm" colorClass={colorRhr(latest.restingHR)} sparkValues={trends.rhr} sparkColorFn={colorRhrFn} trend={rhr_t} />
            <MetricRow label="Sleep" value={fmtN(latest.sleepHours)} unit="h" colorClass={colorSleep(latest.sleepHours)} sparkValues={trends.sleep} sparkColorFn={colorSleepFn} trend={slp_t} />
            <MetricRow label="Sleep quality" value={fmtN(latest.sleepScore)} colorClass={colorSleep(latest.sleepScore ? latest.sleepScore / 10 : null)} sparkValues={trends.sleepScore} />
          </div>
        </Card>

        <div className={styles.sectionSubtitle}>Day health markers</div>
        <Card>
          <div className={styles.grid1}>
            <MetricRow label="HRV (SDNN)" value={fmtN(hm.sdnn)} unit="ms" colorClass={colorHrv(hm.sdnn)} sparkValues={trends.sdnn} sparkColorFn={colorHrvFn} />
            <MetricRow label="Steps" value={fmtSteps(hm.steps)} colorClass={colorSteps(hm.steps)} barValues={trends.steps} barColorFn={colorStepsFn} />
            <MetricRow
              label="SpO₂"
              labelDate={spo2Latest?.date ? fmtDateShort(spo2Latest.date) : null}
              value={fmtN(spo2Latest?.value)}
              unit="%"
              colorClass={colorSpo2(spo2Latest?.value)}
              badge={spo2Badge}
            />
            <MetricRow
              label="VO₂ max"
              labelDate={vo2Latest?.date ? fmtDateShort(vo2Latest.date) : null}
              value={fmtN(vo2Latest?.value)}
              unit="ml/kg"
              colorClass={colorVo2(vo2Latest?.value)}
              badge={vo2Badge}
            />
          </div>
        </Card>

        <div className={styles.sectionSubtitle}>Morning check-in</div>
        <Card>
          <div className={styles.grid1}>
            {wellnessFields.map(f => (
              <WellnessRow key={f} field={f} value={yw[f]} history={wh[f] ?? []} />
            ))}
          </div>
          {yw.comments && <div className={styles.notes}>{yw.comments}</div>}
        </Card>

        {inBody && (
          <>
            <div className={styles.sectionSubtitle}>Body composition</div>
            <Card>
              {inBody.prev && (
                <div className={styles.compHeader}>
                  <strong>{fmtDateShort(inBody.date)}</strong> vs {fmtDateShort(inBody.prev.date)}
                </div>
              )}
              <div className={styles.grid1}>
                <MetricRow label="Weight" value={fmtN(inBody.weight)} unit="kg" badge={inBody.prev ? deltaBadgeFor(inBody.weight, inBody.prev.weight, 'kg', true) : null} />
                <MetricRow label="Fat %" value={fmtN(inBody.fatPct)} unit="%" colorClass={''} badge={inBody.prev ? deltaBadgeFor(inBody.fatPct, inBody.prev.fatPct, '%', true) : null} />
                <MetricRow label="Fat mass" value={fmtN(inBody.fatMass)} unit="kg" badge={inBody.prev ? deltaBadgeFor(inBody.fatMass, inBody.prev.fatMass, 'kg', true) : null} />
                <MetricRow label="BMI" value={fmtN(inBody.bmi)} badge={inBody.prev ? deltaBadgeFor(inBody.bmi, inBody.prev.bmi, '', true) : null} />
              </div>
            </Card>
          </>
        )}
      </>
    )
  }

  if (desktop) return content
  return <MobileLayout title="Vitals" onRefresh={refetch}>{content}</MobileLayout>
}
