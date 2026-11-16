import { WELLNESS } from '../charts/wellness-labels.js'

// Fields the morning check-in logs against yesterday's Intervals entry (stress, mood).
export const YESTERDAY_FIELDS = Object.keys(WELLNESS).filter(k => WELLNESS[k].day === 'yesterday')

const DAY_MS = 86_400_000
export const isoDay = (d = new Date()) => d.toISOString().slice(0, 10)

// Turns the check-in form state into the Intervals wellness updates to send, in order:
// yesterday's entry first (only if any yesterday field was answered), then today's.
// Intervals only ever sees the numeric value 1–4 per field, never the button label.
export function buildCheckinPayloads({ fields = {}, weight = '', notes = '' }, now = new Date()) {
  const today = { date: isoDay(now) }
  const yesterday = {}
  for (const [key, val] of Object.entries(fields)) {
    if (val == null) continue
    ;(YESTERDAY_FIELDS.includes(key) ? yesterday : today)[key] = val
  }

  const w = parseFloat(String(weight).replace(',', '.'))
  if (Number.isFinite(w)) today.weight = w
  if (notes.trim()) today.comments = notes.trim()

  const payloads = []
  if (Object.keys(yesterday).length) {
    payloads.push({ date: isoDay(new Date(now.getTime() - DAY_MS)), ...yesterday })
  }
  payloads.push(today)
  return payloads
}
