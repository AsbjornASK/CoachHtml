import styles from './Ring.module.css'

const R = 38
const C = 2 * Math.PI * R
const SIZE = 96

// Circular progress ring (96×96 SVG). pct 0–100, null shows '?'.
export function Ring({ pct, color, label }) {
  return (
    <div className={styles.wrap}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* track */}
        <circle cx={48} cy={48} r={R} fill="none" stroke="#e5e5ea" strokeWidth={10} />
        {pct != null ? (
          <>
            {/* fill */}
            <circle
              cx={48} cy={48} r={R}
              fill="none"
              stroke={color}
              strokeWidth={10}
              strokeDasharray={C.toFixed(2)}
              strokeDashoffset={((1 - pct / 100) * C).toFixed(2)}
              strokeLinecap="round"
              transform="rotate(-90 48 48)"
            />
            <text x={48} y={44} textAnchor="middle" fontSize={20} fontWeight={800} fill="var(--color-text, #1c1c1e)">{pct}</text>
            <text x={48} y={58} textAnchor="middle" fontSize={10} fill="var(--color-secondary, #8e8e93)">%</text>
          </>
        ) : (
          <text x={48} y={52} textAnchor="middle" fontSize={22} fontWeight={800} fill="var(--color-muted, #aeaeb2)">?</text>
        )}
      </svg>
      <div className={styles.label}>{label}</div>
    </div>
  )
}
