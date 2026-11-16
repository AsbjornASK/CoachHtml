import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { activeCalendars } from '../../api/_lib/calendar.mjs'
import { partnerCompare, lastDays } from '../../src/shared/charts/charts.js'

const CAL_ENVS = ['CAL_TRAINING_ICS_URL', 'FYSISK_HELBRED_ICS_URL', 'CAL_WORK_ICS_URL', 'CAL_SOCIAL_ICS_URL', 'CAL_RELATIONSHIP_ICS_URL', 'CAL_INTERESTS_ICS_URL']

describe('activeCalendars', () => {
  let saved
  beforeEach(() => {
    saved = Object.fromEntries(CAL_ENVS.map(k => [k, process.env[k]]))
    for (const k of CAL_ENVS) delete process.env[k]
  })
  afterEach(() => {
    for (const k of CAL_ENVS) saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])
  })

  it('returns every configured category, not just training', () => {
    process.env.CAL_TRAINING_ICS_URL = 'https://example.test/t.ics'
    process.env.CAL_WORK_ICS_URL = 'https://example.test/w.ics'
    process.env.CAL_SOCIAL_ICS_URL = 'https://example.test/s.ics'
    process.env.CAL_RELATIONSHIP_ICS_URL = 'https://example.test/r.ics'
    process.env.CAL_INTERESTS_ICS_URL = 'https://example.test/i.ics'
    expect(activeCalendars().map(s => s.cat)).toEqual(['training', 'work', 'social', 'relationship', 'interests'])
  })

  it('skips categories without a URL and honours the training fallback', () => {
    process.env.FYSISK_HELBRED_ICS_URL = 'https://example.test/old.ics'
    process.env.CAL_WORK_ICS_URL = 'https://example.test/w.ics'
    expect(activeCalendars()).toEqual([
      { cat: 'training', url: 'https://example.test/old.ics' },
      { cat: 'work', url: 'https://example.test/w.ics' },
    ])
  })

  it('can be limited to training, as "Today\'s sessions" needs', () => {
    process.env.CAL_TRAINING_ICS_URL = 'https://example.test/t.ics'
    process.env.CAL_WORK_ICS_URL = 'https://example.test/w.ics'
    expect(activeCalendars(['training']).map(s => s.cat)).toEqual(['training'])
  })
})

describe('partnerCompare', () => {
  const TODAY = '2026-11-16'
  const series = lastDays([], TODAY, 10).map((d, i) => ({ ...d, partner: i % 2 ? 1 : 2, hrv: 60 + i, rhr: 50 + (i % 3), sleep: 7 + (i % 2) }))

  it('with charts: false shows only the three tiles', () => {
    const html = partnerCompare(series, [], undefined, { charts: false })
    expect((html.match(/class="pc-tile"/g) ?? []).length).toBe(3)
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('pc-chart-label')
    expect(html).toContain('(5 nights)')
  })

  it('still draws the dot charts by default', () => {
    const html = partnerCompare(series, series)
    expect((html.match(/<svg/g) ?? []).length).toBe(3)
  })
})
