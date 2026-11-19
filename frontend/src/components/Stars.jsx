/** Read-only star rating, e.g. ★★★★☆ 4.2 */
export default function Stars({ value = 0, size = 14, label = true }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  return (
    <span className="stars" role="img" aria-label={`Rated ${value} out of 5`} style={{ '--s': `${size}px` }}>
      <span className="stars-bg" aria-hidden="true">★★★★★</span>
      <span className="stars-fg" aria-hidden="true" style={{ width: `${pct}%` }}>★★★★★</span>
      {label && <span className="stars-num">{value.toFixed(1)}</span>}
    </span>
  )
}
