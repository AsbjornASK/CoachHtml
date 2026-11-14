import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MobileLayout } from '../components/MobileLayout'
import { Card } from '../../shared/components/Card'
import { useWellness } from '../../shared/hooks/useWellness'
import { useFetch } from '../../shared/hooks/useFetch'
import { WELLNESS, WELLNESS_COLORS } from '../../shared/charts/wellness-labels'
import styles from './CheckinPage.module.css'

// Today: soreness, fatigue, injury, motivation, Partner (custom YES/NO field)
// Yesterday: stress, mood
const TODAY_FIELDS = ['soreness', 'fatigue', 'injury', 'motivation']
const YESTERDAY_FIELDS = ['stress', 'mood']

function BtnGroup({ field, value, onChange }) {
  const { labels } = WELLNESS[field]
  return (
    <div className={styles.btnGroup}>
      {labels.map((label, i) => (
        <button
          key={i}
          type="button"
          className={`${styles.btn} ${value === i + 1 ? styles.btnActive : ''}`}
          style={value === i + 1 ? { background: WELLNESS_COLORS[i], borderColor: WELLNESS_COLORS[i] } : {}}
          onClick={() => onChange(field, value === i + 1 ? null : i + 1)}
        >
          {label.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

function PartnerField({ value, onChange }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>
        Partner<small className={styles.small}>Slept together last night</small>
      </div>
      <div className={styles.btnGroup}>
        {[['YES', 1], ['NO', 2]].map(([label, val]) => (
          <button
            key={val}
            type="button"
            className={`${styles.btn} ${value === val ? styles.btnActive : ''}`}
            style={value === val ? { background: '#007aff', borderColor: '#007aff' } : {}}
            onClick={() => onChange('Partner', value === val ? null : val)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function CheckinRow({ field, value, onChange }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>{WELLNESS[field].name}</div>
      <BtnGroup field={field} value={value} onChange={onChange} />
    </div>
  )
}

const SUBJ_COLORS = ['#e8f8ee', '#fff8e1', '#ffe5e5', '#f3e8ff']
const SUBJ_TEXT   = ['#1a7a33', '#b86e00', '#c0392b', '#7a1fa2']

function SubjSummaryCard({ todayWellness }) {
  const fields = ['soreness', 'fatigue', 'injury', 'motivation', 'stress', 'mood']
  return (
    <div className={styles.subjGrid}>
      {fields.map(f => {
        const v = todayWellness[f]
        if (v == null) return null
        const label = WELLNESS[f]?.labels[v - 1] ?? v
        return (
          <div
            key={f}
            className={styles.subjItem}
            style={{ background: SUBJ_COLORS[v - 1], color: SUBJ_TEXT[v - 1] }}
          >
            <div className={styles.subjLabel}>{WELLNESS[f]?.name}</div>
            <div className={styles.subjValue}>{label}</div>
          </div>
        )
      })}
    </div>
  )
}

function parseIB(url) {
  try {
    const u = new URL(url)
    const raw = u.searchParams.get('IBData')
    if (!raw) return null
    const dec = decodeURIComponent(raw)
    const pairs = {}
    dec.split('|').forEach(p => {
      const [k, v] = p.split(':')
      if (k && v) pairs[k.trim()] = v.trim()
    })
    const weight = parseFloat(pairs['Weight'] ?? pairs['Wt'])
    const fatPct = parseFloat(pairs['PBF'] ?? pairs['BFP'] ?? pairs['Fat%'])
    const dateRaw = pairs['Date'] ?? pairs['Dt']
    if (!weight || isNaN(weight)) return null
    return { weight, fatPct: isNaN(fatPct) ? null : fatPct, date: dateRaw ?? null }
  } catch { return null }
}

function InBodyCard({ todayWeight, onSaved }) {
  const [ibUrl, setIbUrl] = useState('')
  const [ibMsg, setIbMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const handleImport = async () => {
    const parsed = parseIB(ibUrl)
    if (!parsed) { setIbMsg('Could not parse URL'); return }
    setSaving(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const payload = { date: parsed.date ?? today, weight: parsed.weight }
      if (parsed.fatPct != null) payload.bodyFat = parsed.fatPct
      const res = await fetch('/api/update-wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      setIbMsg('Saved ✓')
      setIbUrl('')
      if (onSaved) onSaved()
    } catch (e) {
      setIbMsg('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <div className={styles.section}>Body</div>
      {todayWeight != null && (
        <div className={styles.row}>
          <div className={styles.rowLabel}>Today's weight</div>
          <div className={styles.weightDisplay}>{todayWeight} kg</div>
        </div>
      )}
      <div className={styles.ibRow}>
        <input
          type="text"
          className={styles.ibInput}
          placeholder="Paste InBody URL…"
          value={ibUrl}
          onChange={e => { setIbUrl(e.target.value); setIbMsg('') }}
        />
        <button
          type="button"
          className={styles.ibBtn}
          disabled={!ibUrl || saving}
          onClick={handleImport}
        >
          Import
        </button>
      </div>
      {ibMsg && <div className={styles.ibMsg}>{ibMsg}</div>}
    </Card>
  )
}

export function CheckinPage({ desktop = false }) {
  const navigate = useNavigate()
  const { submit, loading, error, success } = useWellness()
  const { data: vitalsData } = useFetch('/api/get-vitals')
  const [fields, setFields] = useState({})
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')
  const notesTimer = useRef(null)

  const todayWellness = vitalsData?.todayWellness ?? null
  const checkedInToday = todayWellness != null && Object.keys(todayWellness).some(k => todayWellness[k] != null && k !== 'date' && k !== 'comments')
  const todayWeight = vitalsData?.latest?.weight ?? null

  // Auto-save notes when already checked in
  const handleNotesChange = (e) => {
    const val = e.target.value
    setNotes(val)
    if (!checkedInToday) return
    clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(async () => {
      const today = new Date().toISOString().slice(0, 10)
      try {
        await fetch('/api/update-wellness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: today, comments: val }),
        })
      } catch {}
    }, 1500)
  }

  useEffect(() => () => clearTimeout(notesTimer.current), [])

  const setField = (field, val) => setFields(prev => ({ ...prev, [field]: val }))

  useEffect(() => {
    if (success) navigate('/')
  }, [success, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = { ...fields }
    if (weight) payload.weight = parseFloat(weight.replace(',', '.'))
    if (notes.trim()) payload.notes = notes.trim()
    await submit(payload)
  }

  const checkinForm = (
    <form onSubmit={handleSubmit}>
      <Card>
        <div className={styles.section}>Today</div>
        {TODAY_FIELDS.map(f => (
          <CheckinRow key={f} field={f} value={fields[f] ?? null} onChange={setField} />
        ))}
        <PartnerField value={fields['Partner'] ?? null} onChange={setField} />
      </Card>

      <Card>
        <div className={styles.section}>Yesterday</div>
        {YESTERDAY_FIELDS.map(f => (
          <CheckinRow key={f} field={f} value={fields[f] ?? null} onChange={setField} />
        ))}
      </Card>

      <Card>
        <div className={styles.row}>
          <div className={styles.rowLabel}>
            Weight<small className={styles.small}>kg</small>
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            className={styles.weightInput}
            value={weight}
            onChange={e => setWeight(e.target.value)}
            placeholder="–"
          />
        </div>
        <textarea
          className={styles.notes}
          placeholder="Notes…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
        />
      </Card>

      {error && <div className={styles.errMsg}>{error}</div>}
      {success && <div className={styles.okMsg}>Saved to Intervals ✓</div>}

      <button type="submit" className={styles.submitBtn} disabled={loading}>
        {loading ? 'Saving…' : 'Save to Intervals'}
      </button>
    </form>
  )

  const alreadyCheckedIn = (
    <>
      <Card>
        <div className={styles.section}>Today's check-in</div>
        <SubjSummaryCard todayWellness={todayWellness} />
        <textarea
          className={styles.notes}
          placeholder="Notes…"
          value={notes || (todayWellness?.comments ?? '')}
          onChange={handleNotesChange}
          rows={3}
          style={{ marginTop: 12 }}
        />
      </Card>
      <InBodyCard todayWeight={todayWeight} />
    </>
  )

  const inner = (
    <>
      {checkedInToday ? alreadyCheckedIn : checkinForm}
      {!checkedInToday && <InBodyCard todayWeight={todayWeight} />}
    </>
  )

  if (desktop) return inner
  return <MobileLayout title="Check-in">{inner}</MobileLayout>
}
