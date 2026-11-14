import { useState } from 'react'
import { MobileLayout } from '../components/MobileLayout'
import { Card } from '../../shared/components/Card'
import { Ring } from '../../shared/components/Ring'
import { useCoach } from '../../shared/hooks/useCoach'
import { useCalendar } from '../../shared/hooks/useCalendar'
import { useSportLoad } from '../../shared/hooks/useSportLoad'
import { useDashboard } from '../../shared/hooks/useDashboard'
import { calcRecovery, calcSleep, calcReadiness, verdictColor } from '../../shared/utils/readiness'
import { WELLNESS } from '../../shared/charts/wellness-labels'
import styles from './HomePage.module.css'

const EN_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const EN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtN(v, u = '') {
  if (v == null) return '–'
  return String(v).replace('.', ',') + (u ? ' ' + u : '')
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

const TLR_ZONES = [
  { min: -25, max: -20, color: '#ff3b30', label: 'Overreaching',       desc: 'Training load is excessive — high risk of burnout or injury.' },
  { min: -20, max: -10, color: '#ff9f0a', label: 'Accumulated fatigue', desc: 'Fatigue has built up — recovery is falling behind.' },
  { min: -10, max: -5,  color: '#bf5af2', label: 'Build phase',         desc: "You're building fitness with manageable fatigue." },
  { min: -5,  max: 5,   color: '#007aff', label: 'Maintenance',         desc: 'ATL and CTL are balanced.' },
  { min: 5,   max: 10,  color: '#30d158', label: 'Peak form',           desc: 'Primed for peak performance with fresh legs.' },
  { min: 10,  max: 15,  color: '#ffcc00', label: 'Tapered',             desc: "Well rested — may be losing fitness from reduced training." },
]
const TLR_MIN_SD = 0.3
const TLR_Z_BOUNDS = [-2.5, -2, -1, -0.5, 0.5, 1, 1.5]
const TLR_Z_ZONES = TLR_ZONES.map((z, i) => ({ ...z, min: TLR_Z_BOUNDS[i], max: TLR_Z_BOUNDS[i + 1] }))

const TAB_LABELS = { overall: 'Overall', run: 'Run', ride: 'Bike', strength: 'Strength' }
const SUBJ_FIELDS = ['soreness', 'fatigue', 'motivation', 'stress', 'mood', 'sleepQuality']
const SUBJ_COLORS = ['#e8f8ee:#1a7a33', '#fff8e1:#b86e00', '#ffe5e5:#c0392b', '#f3e8ff:#7a1fa2']

function colorFor(r) {
  return r >= 65 ? '#30d158' : r >= 45 ? '#ff9f0a' : '#ff3b30'
}

function ReadinessHistGraph({ trends }) {
  const { hrv, rhr, sleep, sleepScore, tsb, fatigue, soreness, dates } = trends
  const len = Math.min(hrv.length, rhr.length, sleep.length)
  const vals = []
  for (let i = 0; i < len; i++) {
    const rec = calcRecovery(hrv[i], rhr[i], sleep[i], (tsb ?? [])[i] ?? null)
    const slp = calcSleep(sleep[i], (sleepScore ?? [])[i] ?? null, null)
    const subj = { fatigue: (fatigue ?? [])[i] ?? null, soreness: (soreness ?? [])[i] ?? null }
    vals.push(calcReadiness(rec, slp, subj))
  }
  const pts = vals.map((v, i) => v != null ? { x: i, v, date: (dates ?? [])[i] ?? null } : null).filter(Boolean)
  if (pts.length < 2) return null
  const vs = pts.map(p => p.v)
  const mn = Math.min(...vs), mx = Math.max(...vs), rng = mx - mn || 1
  const W = 300, H = 56, scoreLblH = 14, axH = 14, pd = 10, pdY = 6
  const totalH = scoreLblH + H + axH
  const px = x => pd + (x / (vals.length - 1)) * (W - 2 * pd)
  const py = v => scoreLblH + pdY + (1 - (v - mn) / rng) * (H - 2 * pdY)
  const fmtDate = d => { if (!d) return ''; const p = d.split('-'); return `${p[2]}/${p[1]}` }
  const segments = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    if (b.x - a.x === 1) {
      const midV = (a.v + b.v) / 2
      segments.push(<line key={i} x1={px(a.x)} y1={py(a.v)} x2={px(b.x)} y2={py(b.v)} stroke={colorFor(midV)} strokeWidth={2} strokeLinecap="round" />)
    }
  }
  return (
    <div className={styles.readinessHist}>
      <div className={styles.readinessHistLabel}>Readiness history</div>
      <svg viewBox={`0 0 ${W} ${totalH}`} width="100%" height={totalH}>
        {segments}
        {pts.map(p => <circle key={p.x} cx={px(p.x)} cy={py(p.v)} r={3.5} fill={colorFor(p.v)} />)}
        {pts.map(p => <text key={`s${p.x}`} x={px(p.x)} y={py(p.v) - 7} fontSize={8} fontWeight={700} fill={colorFor(p.v)} textAnchor="middle">{p.v}</text>)}
        {pts.map(p => <text key={`d${p.x}`} x={px(p.x)} y={scoreLblH + H + axH - 1} fontSize={8} fill="#aeaeb2" textAnchor="middle">{fmtDate(p.date)}</text>)}
      </svg>
    </div>
  )
}

function FitnessGraph({ hist }) {
  const days = hist.filter(d => d.ctl != null || d.atl != null)
  if (days.length < 2) return null
  const all = [...days.map(d => d.ctl), ...days.map(d => d.atl)].filter(v => v != null && v > 0)
  if (!all.length) return null
  const mn = Math.min(...all), mx = Math.max(...all), rng = mx - mn || 1
  const W = 300, H = 88, axH = 20, pd = 10, pdY = 4
  const px = i => pd + i * (W - 2 * pd) / (days.length - 1)
  const py = v => pdY + (1 - (v - mn) / rng) * (H - 2 * pdY)
  const cPts = days.map((d, i) => d.ctl != null ? `${px(i).toFixed(1)},${py(d.ctl).toFixed(1)}` : null).filter(Boolean).join(' ')
  const aPts = days.map((d, i) => d.atl != null ? `${px(i).toFixed(1)},${py(d.atl).toFixed(1)}` : null).filter(Boolean).join(' ')
  const idxs = [...new Set([0, Math.floor(days.length * 0.33), Math.floor(days.length * 0.66), days.length - 1])]
  return (
    <div>
      <div className={styles.graphLegend}>
        <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: '#007aff' }} />CTL</div>
        <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: '#ff9f0a' }} />ATL</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H + axH}`} width="100%" height={H + axH}>
        <line x1={0} y1={H * 0.33} x2={W} y2={H * 0.33} stroke="#f2f2f7" strokeWidth={1} />
        <line x1={0} y1={H * 0.66} x2={W} y2={H * 0.66} stroke="#f2f2f7" strokeWidth={1} />
        <polyline fill="none" stroke="#007aff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" points={cPts} />
        <polyline fill="none" stroke="#ff9f0a" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" points={aPts} />
        {idxs.map(i => {
          const d = new Date(days[i].date + 'T12:00:00')
          return <text key={i} x={px(i)} y={H + axH - 2} fontSize={8} fill="#aeaeb2" textAnchor="middle">{d.getDate()}/{d.getMonth() + 1}</text>
        })}
      </svg>
    </div>
  )
}

function TlrCard({ tsb, title, zones = TLR_ZONES, pos = null, note = null }) {
  const p = pos ?? tsb
  const SCALE_MIN = zones[0].min, SCALE_MAX = zones[zones.length - 1].max, total = SCALE_MAX - SCALE_MIN
  const hasVal = p != null
  const clamped = hasVal ? Math.min(SCALE_MAX, Math.max(SCALE_MIN, p)) : 0
  const pct = ((clamped - SCALE_MIN) / total * 100).toFixed(2)
  const active = hasVal ? (zones.find(z => p >= z.min && p < z.max) ?? (p >= SCALE_MAX ? zones[zones.length - 1] : zones[0])) : null
  const color = active ? active.color : '#8e8e93'
  return (
    <Card>
      <div className={styles.cardTitle}>{title}</div>
      <div className={styles.tlrZoneLabel} style={{ color }}>{active ? active.label : 'No data'}</div>
      <div className={styles.tlrRow}>
        <div className={styles.tlrValue} style={{ color }}>{fmtN(tsb)}</div>
        <div className={styles.tlrBar}>
          <div className={styles.tlrBarTrack}>
            {zones.map((z, i) => (
              <div key={i} className={styles.tlrSeg} style={{ width: `${((z.max - z.min) / total * 100).toFixed(2)}%`, background: z.color }} />
            ))}
          </div>
          <div className={styles.tlrDot} style={{ left: `${pct}%`, color }} />
        </div>
      </div>
      {note && <div className={styles.tlrNote}>{note}</div>}
      {active && <div className={styles.tlrDesc}>{active.desc}</div>}
    </Card>
  )
}

function SessionsCard({ cal }) {
  const today = cal?.today ?? []
  if (!today.length) {
    return (
      <Card>
        <div className={styles.cardTitle}>Today's sessions</div>
        <div className={styles.workoutRow}><span className={styles.workoutTitle} style={{ color: '#aeaeb2' }}>Rest day</span></div>
      </Card>
    )
  }
  const training = today.filter(e => e.category === 'training' || !e.category)
  const sessions = training.length ? training : today
  return (
    <Card>
      <div className={styles.cardTitle}>Today's sessions</div>
      {sessions.map((e, i) => (
        <div key={i} className={styles.workoutRow}>
          <div>
            <div className={styles.workoutTitle}>{e.title}</div>
            <div className={styles.workoutTime}>{e.timeStart ?? ''}{e.timeEnd ? '–' + e.timeEnd : ''}</div>
          </div>
        </div>
      ))}
    </Card>
  )
}

function UpcomingCard({ upcoming }) {
  if (!upcoming?.length) return null
  return (
    <Card>
      <div className={styles.cardTitle}>Upcoming sessions</div>
      {upcoming.map((e, i) => {
        const d = new Date(e.date + 'T12:00:00')
        return (
          <div key={i} className={styles.upcomingRow}>
            <div className={styles.upcomingDate}>
              <div className={styles.udateDay}>{EN_DAYS[d.getDay()]}</div>
              <div className={styles.udateNum}>{d.getDate()}/{d.getMonth() + 1}</div>
            </div>
            <div className={styles.upcomingInfo}>
              <div className={styles.upcomingTitle}>{e.title}</div>
              <div className={styles.upcomingTime}>{e.timeStart ?? ''}{e.timeEnd ? '–' + e.timeEnd : ''}</div>
            </div>
          </div>
        )
      })}
    </Card>
  )
}

function SubjGrid({ subjective }) {
  if (!subjective) return null
  const items = SUBJ_FIELDS.map(f => {
    const val = subjective[f]
    if (val == null) return null
    const cfg = WELLNESS[f]
    if (!cfg) return null
    const label = cfg.labels[val - 1] ?? '–'
    const [bg, fg] = (SUBJ_COLORS[val - 1] ?? '#f2f2f7:#aeaeb2').split(':')
    return { f, name: cfg.name, label, bg, fg }
  }).filter(Boolean)
  if (!items.length) return null
  return (
    <Card>
      <div className={styles.cardTitle}>Morning check-in</div>
      <div className={styles.subjGrid}>
        {items.map(({ f, name, label, bg, fg }) => (
          <div key={f} className={styles.subjItem} style={{ background: bg, color: fg }}>
            <div className={styles.subjLabel}>{name}</div>
            <div className={styles.subjValue}>{label}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

const STRESS_COLORS = ['#30d158', '#ff9f0a', '#ff9f0a', '#ff3b30']
const FATIGUE_COLORS = ['#30d158', '#ff9f0a', '#ff9f0a', '#ff3b30']

function StressFatigueChart({ series, days = 21 }) {
  if (!series?.length) return null
  const today = series[series.length - 1]?.date
  if (!today) return null

  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - days + 1)
  const pts = series.filter(d => d.date >= cutoff.toISOString().slice(0, 10) && (d.stress != null || d.fatigue != null))
  if (pts.length < 2) return null

  const W = 300, H = 90, axH = 16, pd = 6, pdY = 4
  const totalDays = days
  const dateIdx = d => {
    const diff = (new Date(d.date) - new Date(today + 'T00:00:00')) / 86400000
    return totalDays - 1 + diff
  }
  const px = i => pd + (i / (totalDays - 1)) * (W - 2 * pd)
  const py = v => pdY + (1 - (v - 1) / 3) * (H - 2 * pdY)

  const stressPts = pts.filter(d => d.stress != null).map(d => ({ x: dateIdx(d), v: d.stress, date: d.date }))
  const fatiguePts = pts.filter(d => d.fatigue != null).map(d => ({ x: dateIdx(d), v: d.fatigue, date: d.date }))

  const polyline = (ps, color) => {
    if (ps.length < 2) return null
    const points = ps.map(p => `${px(p.x).toFixed(1)},${py(p.v).toFixed(1)}`).join(' ')
    return <polyline fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" points={points} />
  }

  const dots = (ps, colors) => ps.map((p, i) => (
    <circle key={i} cx={px(p.x)} cy={py(p.v)} r={3} fill={colors[Math.round(p.v) - 1] ?? '#aeaeb2'} />
  ))

  // x-axis: show ~4 date labels
  const idxs = [0, Math.floor(totalDays * 0.33), Math.floor(totalDays * 0.66), totalDays - 1]
  const dateLabels = idxs.map(i => {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() - (totalDays - 1 - i))
    return { i, label: `${d.getDate()}/${d.getMonth() + 1}` }
  })

  return (
    <div className={styles.sfChart}>
      <div className={styles.graphLegend}>
        <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: '#ff9f0a' }} />Stress</div>
        <div className={styles.legendItem}><div className={styles.legendDot} style={{ background: '#007aff' }} />Fatigue</div>
      </div>
      <div className={styles.sfYLabels}>
        {['High', 'Med', 'Low'].map(l => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H + axH}`} width="100%" height={H + axH}>
        <line x1={pd} y1={py(2.5)} x2={W - pd} y2={py(2.5)} stroke="#f2f2f7" strokeWidth={1} strokeDasharray="3 3" />
        {polyline(stressPts, '#ff9f0a')}
        {polyline(fatiguePts, '#007aff')}
        {dots(stressPts, STRESS_COLORS)}
        {dots(fatiguePts, FATIGUE_COLORS.map(() => '#007aff'))}
        {dateLabels.map(({ i, label }) => (
          <text key={i} x={px(i)} y={H + axH - 1} fontSize={8} fill="#aeaeb2" textAnchor="middle">{label}</text>
        ))}
      </svg>
    </div>
  )
}

export function HomePage({ desktop = false }) {
  const { data, loading: loadingCoach, error: errorCoach } = useCoach()
  const { data: cal } = useCalendar()
  const { data: sportLoad } = useSportLoad()
  const { data: dashData } = useDashboard()
  const [fitTab, setFitTab] = useState(null)

  let content
  if (loadingCoach) {
    content = (
      <>
        <div className={`${styles.skeleton} ${styles.skelCard}`} />
        <div className={`${styles.skeleton} ${styles.skelCard}`} />
        <div className={`${styles.skeleton} ${styles.skelCard}`} />
      </>
    )
  } else if (errorCoach) {
    content = <div className={styles.error}>Could not load data: {errorCoach}</div>
  } else {
    const { latest, trends, sleep8, subjective, fitnessHistory } = data
    const dashSeries = dashData?.series ?? []

    const rec = calcRecovery(latest.hrv, latest.restingHR, latest.sleepHours, latest.tsb)
    const slp = calcSleep(latest.sleepHours, latest.sleepScore, sleep8)
    const ready = calcReadiness(rec, slp, subjective)

    const rColor = ready != null ? colorFor(ready) : '#aeaeb2'
    const recColor = rec != null ? colorFor(rec) : '#aeaeb2'
    const slpColor = slp != null ? colorFor(slp) : '#aeaeb2'

    const hrv_t = trendDir(trends.hrv)
    const rhr_t = trendDir(trends.rhr, true)
    const slp_t = trendDir(trends.sleep)

    const trendCls = c => c === 'up' ? styles.trendUp : c === 'down' ? styles.trendDown : styles.trendFlat

    // Determine active tab
    const hasSport = !!sportLoad?.series?.length
    const activeTab = fitTab ?? 'overall'

    function getTabData(tab) {
      if (tab !== 'overall' && sportLoad?.series?.length) {
        const cur = sportLoad.series[sportLoad.series.length - 1][tab]
        return { ctl: cur?.ctl, atl: cur?.atl, tsb: cur?.tsb, hist: sportLoad.series.map(d => ({ date: d.date, ...d[tab] })), rampRate: null }
      }
      return { ctl: latest.ctl, atl: latest.atl, tsb: latest.tsb, hist: fitnessHistory ?? [], rampRate: latest.rampRate }
    }

    const tabD = getTabData(activeTab)
    const { ctl, atl, tsb, hist, rampRate: rr } = tabD

    let tlrCard
    if (activeTab === 'overall') {
      tlrCard = <TlrCard tsb={tsb} title="Training Load Ratio" />
    } else {
      const b = sportLoad?.baseline?.[activeTab]
      if (tsb == null || !(b?.sd >= TLR_MIN_SD)) {
        tlrCard = <TlrCard tsb={tsb} title={`Training Load Ratio · ${TAB_LABELS[activeTab]}`} zones={TLR_Z_ZONES} pos={null} />
      } else {
        const z = (tsb - b.mean) / b.sd
        const r1 = v => Math.round(v * 10) / 10
        tlrCard = <TlrCard tsb={tsb} title={`Training Load Ratio · ${TAB_LABELS[activeTab]}`} zones={TLR_Z_ZONES} pos={z} note={`${fmtN(r1(Math.abs(z)))} SD ${z < 0 ? 'below' : 'above'} your ${b.days}-day norm (${fmtN(b.mean)} ± ${fmtN(r1(b.sd))})`} />
      }
    }

    const lvl = rr == null ? null : Math.abs(rr) <= 1 ? 'stable' : Math.abs(rr) <= 2.5 ? 'rising' : 'high'
    const rampColor = lvl === 'stable' ? '#30d158' : lvl === 'rising' ? '#ff9f0a' : '#ff3b30'

    content = (
      <>
        <div className={styles.sectionHeader}>Body</div>
        <Card>
          <div className={styles.rings}>
            <Ring pct={ready} color={rColor} label="Readiness" />
            <Ring pct={rec} color={recColor} label="Recovery" />
            <Ring pct={slp} color={slpColor} label="Sleep" />
          </div>
          <ReadinessHistGraph trends={trends} />
        </Card>

        <Card>
          <div className={styles.cardTitle}>Night physiology</div>
          <div className={styles.physioRow}>
            <div className={styles.physioItem}>
              <div className={styles.metricLabel}>HRV</div>
              <div className={styles.metricValue}>{fmtN(latest.hrv)} <span className={styles.unit}>ms</span> <span className={trendCls(hrv_t.c)}>{hrv_t.a}</span></div>
            </div>
            <div className={styles.physioItem}>
              <div className={styles.metricLabel}>Resting HR</div>
              <div className={styles.metricValue}>{fmtN(latest.restingHR)} <span className={styles.unit}>bpm</span> <span className={trendCls(rhr_t.c)}>{rhr_t.a}</span></div>
            </div>
            <div className={styles.physioItem}>
              <div className={styles.metricLabel}>Sleep</div>
              <div className={styles.metricValue}>{fmtN(latest.sleepHours)} <span className={styles.unit}>h</span> <span className={trendCls(slp_t.c)}>{slp_t.a}</span></div>
            </div>
          </div>
        </Card>

        {dashSeries.length > 0 && (
          <Card>
            <div className={styles.cardTitle}>Stress & Fatigue · 21 days</div>
            <StressFatigueChart series={dashSeries} days={21} />
          </Card>
        )}

        <div className={styles.sectionHeader}>Training</div>
        <div className={styles.tabBar}>
          {Object.entries(TAB_LABELS).map(([k, l]) => (
            <button
              key={k}
              className={`${styles.tabBtn}${activeTab === k ? ' ' + styles.tabBtnActive : ''}`}
              disabled={k !== 'overall' && !hasSport}
              onClick={() => setFitTab(k)}
            >
              {l}
            </button>
          ))}
        </div>

        <Card>
          <div className={styles.cardTitle}>
            {activeTab === 'overall' ? 'Fitness' : `Fitness · ${TAB_LABELS[activeTab]}`}
            {lvl && activeTab === 'overall' && (
              <span className={styles.rampBadge} style={{ color: rampColor, background: rampColor + '22' }}>
                {lvl.charAt(0).toUpperCase() + lvl.slice(1)} {fmtN(rr)}
              </span>
            )}
          </div>
          <div className={styles.fitnessNumbers}>
            <div className={styles.fitnessNumItem}><div className={styles.fnumLabel}>CTL</div><div className={styles.fnumValue}>{fmtN(ctl)}</div></div>
            <div className={styles.fitnessNumItem}><div className={styles.fnumLabel}>ATL</div><div className={styles.fnumValue}>{fmtN(atl)}</div></div>
            <div className={styles.fitnessNumItem}><div className={styles.fnumLabel}>TSB</div><div className={styles.fnumValue} style={{ color: (tsb ?? 0) >= 0 ? '#30d158' : '#ff9f0a' }}>{fmtN(tsb)}</div></div>
          </div>
          <FitnessGraph hist={hist} />
        </Card>

        {tlrCard}

        <div className={styles.sectionHeader}>Today</div>
        <SessionsCard cal={cal} />
        {cal?.upcoming?.length > 0 && <UpcomingCard upcoming={cal.upcoming} />}

        {subjective && <SubjGrid subjective={subjective} />}
      </>
    )
  }

  if (desktop) return content
  return <MobileLayout title="Coach">{content}</MobileLayout>
}
