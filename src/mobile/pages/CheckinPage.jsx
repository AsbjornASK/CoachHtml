import { useState } from 'react'
import { MobileLayout } from '../components/MobileLayout'
import { Card } from '../../shared/components/Card'
import { useWellness } from '../../shared/hooks/useWellness'
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

export function CheckinPage({ desktop = false }) {
  const { submit, loading, error, success } = useWellness()
  const [fields, setFields] = useState({})
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')

  const setField = (field, val) => setFields(prev => ({ ...prev, [field]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = { ...fields }
    if (weight) payload.weight = parseFloat(weight.replace(',', '.'))
    if (notes.trim()) payload.notes = notes.trim()
    await submit(payload)
    if (!error) {
      const today = new Date().toISOString().slice(0, 10)
      try { localStorage.setItem(`checkin-${today}`, JSON.stringify(payload)) } catch {}
    }
  }

  const inner = (
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
  if (desktop) return inner
  return <MobileLayout title="Check-in">{inner}</MobileLayout>
}
