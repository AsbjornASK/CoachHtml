const SCORE = { 1: -1, 2: 0, 3: 1, 4: 3 }
const scoreOf = v => SCORE[v] ?? 0

export function computeBurden(series, days = 30) {
  if (!series.length) return []
  const window = series.slice(-days)
  let burden = 0
  return window.map(d => {
    const raw = scoreOf(d.stress) + scoreOf(d.fatigue) + scoreOf(d.soreness)
    burden = burden * 0.85 + raw * 0.15
    return { date: d.date, burden: Math.round(burden * 100) / 100, sick: (d.injury ?? 0) >= 3 }
  })
}
