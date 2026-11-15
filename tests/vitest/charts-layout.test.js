import { describe, it, expect } from 'vitest'
import { TL, timelineLabels, hrvCheckinChart, sleepMoodChart, hrvCalStressChart, lastDays } from '../../src/shared/charts/charts.js'

const PHONE_TL = { W: 340, PDL: 40, PDR: 10, compact: true }
const TODAY = '2026-11-15'

function series(n) {
  return lastDays([], TODAY, n).map((d, i) => ({
    ...d, hrv: 60 + (i % 5), sdnn: 50 + (i % 4), sleep: 7 + (i % 3) * 0.5, fatigue: 1 + (i % 4), mood: 1 + (i % 4), stress: 1 + (i % 4),
  }))
}

const labelCount = html => (html.match(/class="x-tick"/g) ?? []).length

describe('timelineLabels', () => {
  it('keeps the old density on the default layout', () => {
    expect(labelCount(timelineLabels(series(10), 100, TL))).toBe(10)
    expect(labelCount(timelineLabels(series(21), 100, TL))).toBe(11)
  })

  it('thins labels on a phone-width layout so they cannot overlap', () => {
    const days = series(14)
    const gap = (PHONE_TL.W - PHONE_TL.PDL - PHONE_TL.PDR) / (days.length - 1)
    const step = Math.ceil(34 / gap)
    expect(labelCount(timelineLabels(days, 100, PHONE_TL))).toBe(Math.ceil(days.length / step))
    expect(step * gap).toBeGreaterThanOrEqual(34)
  })

  it('always labels the last day', () => {
    expect(timelineLabels(series(14), 100, PHONE_TL)).toContain('>15/11<')
  })
})

describe('compact layout', () => {
  it('drops the rotated axis label and draws at phone width', () => {
    const hrv = hrvCheckinChart(series(14), PHONE_TL)
    const sleep = sleepMoodChart(series(14), PHONE_TL)
    expect(hrv).toContain('viewBox="0 0 340 200"')
    expect(hrv).not.toContain('rotate(-90')
    expect(sleep).not.toContain('rotate(-90')
    expect(hrvCheckinChart(series(14))).toContain('rotate(-90')
  })
})

describe('theme colours', () => {
  it('charts carry no hard-coded light surface colours', () => {
    const s = series(14)
    const html = hrvCheckinChart(s) + sleepMoodChart(s) + hrvCalStressChart(s.slice(-7), s, null, 375)
    for (const hex of ['#f2f2f7', '#f9f9fb', '#e5e5ea', '#d1d1d6', '#1c1c1e', 'stroke="#fff"']) {
      expect(html).not.toContain(hex)
    }
    expect(html).toContain('var(--chart-grid)')
    expect(html).toContain('var(--chart-band)')
  })
})
