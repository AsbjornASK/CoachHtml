// Labels and colours for Intervals wellness values 1–4 (1 = best)
// day: 'yesterday' marks fields the morning check-in logs against yesterday's entry.

export const WELLNESS = {
  mood:         { name: 'Mood',          labels: ['Great', 'Good', 'Avg', 'Low'], day: 'yesterday' },
  soreness:     { name: 'Soreness',      labels: ['Restored', 'Fresh', 'Sore', 'Very sore'] },
  fatigue:      { name: 'Fatigue',       labels: ['Fresh', 'Normal', 'Tired', 'Drained'] },
  motivation:   { name: 'Motivation',    labels: ['Extreme', 'High', 'Medium', 'Low'] },
  stress:       { name: 'Stress',        labels: ['Restorative', 'Low', 'Medium', 'High'], short: ['Rest.', 'Low', 'Med', 'High'], day: 'yesterday' },
  sleepQuality: { name: 'Sleep quality', labels: ['High', 'Good', 'Avg', 'Poor'] },
  injury:       { name: 'Sick/injured',  labels: ['None', 'Mild', 'Sick', 'Sidelined'] },
}

export const WELLNESS_COLORS = ['#30d158', '#ff9f0a', '#ff3b30', '#bf5af2']
export const WELLNESS_BTN_CLASSES = ['c-green', 'c-yellow', 'c-red', 'c-purple']
