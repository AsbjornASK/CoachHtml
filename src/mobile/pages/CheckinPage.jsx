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
    const m = url.match(/[?&]IBData=([^&\s]+)/)
    if (!m) return null
    const raw = decodeURIComponent(m[1])
    const segs = raw.split('!')
    const main = segs.find(s => /^\d{8}[MF]\d{8}/.test(s))
    if (!main) return null
    const ds = main.substring(9, 17)
    const fat = parseInt(main.substring(47, 51)) / 10
    const w = parseInt(main.substring(115, 119)) / 10
    const date = `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}`
    return { date, weight: w, fatPct: Math.round(fat / w * 1000) / 10 }
  } catch { return null }
}

function InBodyCard({ todayWeight, onSaved }) {
  const [ibUrl, setIbUrl] = useState('')
  const [ibMsg, setIbMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(null)

  const handleParse = () => {
    const parsed = parseIB(ibUrl)
    if (!parsed) { setIbMsg('Could not parse URL'); return }
    setPreview(parsed)
    setIbMsg('')
  }

  const handleConfirm = async () => {
    if (!preview) return
    setSaving(true)
    try {
      const payload = { date: preview.date, weight: preview.weight }
      if (preview.fatPct != null) payload.bodyFat = preview.fatPct
      const res = await fetch('/api/update-wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      setIbMsg('Saved ✓')
      setIbUrl('')
      setPreview(null)
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
          onChange={e => { setIbUrl(e.target.value); setIbMsg(''); setPreview(null) }}
        />
        <button
          type="button"
          className={styles.ibBtn}
          disabled={!ibUrl || saving}
          onClick={handleParse}
        >
          Preview
        </button>
      </div>
      {preview && (
        <div className={styles.ibPreview}>
          <div className={styles.ibPreviewRow}><span>Date</span><strong>{preview.date}</strong></div>
          <div className={styles.ibPreviewRow}><span>Weight</span><strong>{preview.weight} kg</strong></div>
          {preview.fatPct != null && (
            <div className={styles.ibPreviewRow}><span>Body fat</span><strong>{preview.fatPct}%</strong></div>
          )}
          <div className={styles.ibPreviewActions}>
            <button type="button" className={styles.ibBtn} disabled={saving} onClick={handleConfirm}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className={styles.ibBtnCancel} onClick={() => setPreview(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {ibMsg && <div className={styles.ibMsg}>{ibMsg}</div>}
    </Card>
  )
}

export function CheckinPage({ desktop = false }) {
  const navigate = useNavigate()
  const { submit, loading, error, success } = useWellness()
  const { data: vitalsData, error: vitalsError, refetch } = useFetch('/api/get-vitals')
  const [fields, setFields] = useState({})
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')
  const notesTimer = useRef(null)

  const todayWellness = vitalsData?.todayWellness ?? null
  const CHECKIN_FIELDS = new Set([...TODAY_FIELDS, ...YESTERDAY_FIELDS, 'Partner', 'sleepQuality'])
  const checkedInToday = todayWellness != null && Object.keys(todayWellness).some(k => CHECKIN_FIELDS.has(k) && todayWellness[k] != null)
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

  if (vitalsError && !vitalsData) {
    return (
      <MobileLayout title="Check-in">
        <Card>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>⚙️</div>
            <div className={styles.emptyTitle}>Setup required</div>
            <div className={styles.emptyBody}>
              Configure your Intervals.icu API credentials to start tracking your wellness.
            </div>
          </div>
        </Card>
      </MobileLayout>
    )
  }

  return <MobileLayout title="Check-in" onRefresh={refetch}>{inner}</MobileLayout>
}
