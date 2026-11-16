import { describe, it, expect } from 'vitest'
import { buildCheckinPayloads, YESTERDAY_FIELDS } from '../../src/shared/utils/checkinPayload.js'
import { WELLNESS } from '../../src/shared/charts/wellness-labels.js'

const NOW = new Date('2026-11-16T07:30:00Z')

describe('buildCheckinPayloads', () => {
  it('always dates today\'s entry (the API rejects a payload without a date)', () => {
    const [today] = buildCheckinPayloads({ fields: { soreness: 2 } }, NOW)
    expect(today).toEqual({ date: '2026-11-16', soreness: 2 })
  })

  it('sends stress and mood to yesterday first, the rest to today', () => {
    expect(YESTERDAY_FIELDS).toEqual(['mood', 'stress'])
    const payloads = buildCheckinPayloads(
      { fields: { soreness: 1, fatigue: 3, injury: 1, motivation: 2, Partner: 1, stress: 4, mood: 2 } }, NOW)
    expect(payloads).toEqual([
      { date: '2026-11-15', stress: 4, mood: 2 },
      { date: '2026-11-16', soreness: 1, fatigue: 3, injury: 1, motivation: 2, Partner: 1 },
    ])
  })

  it('sends only numbers 1–4 for scale fields, never label text', () => {
    const fields = Object.fromEntries(Object.keys(WELLNESS).map((k, i) => [k, (i % 4) + 1]))
    for (const p of buildCheckinPayloads({ fields }, NOW)) {
      for (const [k, v] of Object.entries(p)) {
        if (k === 'date') continue
        expect(Number.isInteger(v) && v >= 1 && v <= WELLNESS[k].labels.length).toBe(true)
      }
    }
  })

  it('drops deselected answers instead of sending null', () => {
    const payloads = buildCheckinPayloads({ fields: { soreness: null, stress: null, fatigue: 2 } }, NOW)
    expect(payloads).toEqual([{ date: '2026-11-16', fatigue: 2 }])
  })

  it('sends weight as a number and notes as Intervals "comments"', () => {
    const [today] = buildCheckinPayloads({ fields: {}, weight: '74,6', notes: '  slept badly ' }, NOW)
    expect(today).toEqual({ date: '2026-11-16', weight: 74.6, comments: 'slept badly' })
  })

  it('ignores an empty or unparseable weight', () => {
    expect(buildCheckinPayloads({ fields: {}, weight: '' }, NOW)).toEqual([{ date: '2026-11-16' }])
    expect(buildCheckinPayloads({ fields: {}, weight: 'abc' }, NOW)).toEqual([{ date: '2026-11-16' }])
  })
})
