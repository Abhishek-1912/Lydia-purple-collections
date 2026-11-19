// Graphics drawn from the saree itself: korvai temple border, mango butta, and gold line icons.
// All inline SVG (no image downloads) so phones stay fast.

/** Temple (gopuram) border like a Kanjivaram korvai — used as the divider between home sections. */
export function TempleBorder({ className = '' }) {
  return (
    <div className={`temple-border ${className}`} role="presentation" aria-hidden="true" />
  )
}

const L = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const TrustIcons = {
  upi: (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...L}>
      <rect x="14" y="5" width="20" height="38" rx="4" /><path d="M21 9h6" />
      <path d="M19 30l4-12 4 12M20.5 26h5" /><circle cx="24" cy="38.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  ),
  cod: (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...L}>
      <rect x="6" y="14" width="30" height="18" rx="2" /><circle cx="21" cy="23" r="4.5" />
      <path d="M10 18v0M32 28v0" /><path d="M36 20h4l3 5v7h-7" /><circle cx="14" cy="36" r="3" /><circle cx="38" cy="36" r="3" />
      <path d="M17 36h18" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...L}>
      <path d="M8 24a16 16 0 1 1 6.6 13L8 40l2.4-6.4A15.9 15.9 0 0 1 8 24z" />
      <path d="M18 19c0 6 5 11 11 11l2.5-2.5-3.5-2-1.6 1.6c-2-.8-3.7-2.5-4.5-4.5l1.6-1.6-2-3.5z" />
    </svg>
  ),
  quality: (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...L}>
      <path d="M33 6l-20 30" /><ellipse cx="34.5" cy="5.8" rx="1.6" ry="3" transform="rotate(34 34.5 5.8)" />
      <path d="M13 36c-4 4-2 8 3 7s9-6 14-4 6 6 9 4" /><path d="M30 18l4 3M27 22.5l4 3" />
    </svg>
  ),
}

export const OccasionIcons = {
  Wedding: ( // mandap
    <svg viewBox="0 0 48 48" aria-hidden="true" {...L}>
      <path d="M6 18 24 7l18 11" /><path d="M9 17v24M39 17v24M17 22v19M31 22v19" /><path d="M6 41h36" />
      <path d="M17 22c2-3 5-4 7-4s5 1 7 4" /><circle cx="24" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  ),
  Pooja: ( // kalash
    <svg viewBox="0 0 48 48" aria-hidden="true" {...L}>
      <path d="M17 24c-4 3-5 8-2 12s16 4 19 0 2-9-2-12z" /><path d="M18 24h14M20 20h10v4H20z" />
      <path d="M24 20c-1-4-6-5-9-3M24 20c1-4 6-5 9-3M24 20v-7" /><circle cx="24" cy="10.5" r="2.5" /><path d="M18 30h14" />
    </svg>
  ),
  Festivals: ( // diya
    <svg viewBox="0 0 48 48" aria-hidden="true" {...L}>
      <path d="M8 30c4 7 28 7 32 0H8z" /><path d="M14 36l-2 5h24l-2-5" />
      <path d="M24 26c-4-3-4-8 0-14 4 6 4 11 0 14z" /><path d="M24 22c-1.5-1-1.5-3 0-5 1.5 2 1.5 4 0 5z" />
    </svg>
  ),
  Party: ( // sparkles
    <svg viewBox="0 0 48 48" aria-hidden="true" {...L}>
      <path d="M20 8l3 10 10 3-10 3-3 10-3-10-10-3 10-3z" /><path d="M36 28l1.6 5 5 1.6-5 1.6L36 41l-1.6-4.8-5-1.6 5-1.6z" />
      <path d="M37 7v6M34 10h6" />
    </svg>
  ),
  Office: ( // folded saree on a hanger-free stack: handbag
    <svg viewBox="0 0 48 48" aria-hidden="true" {...L}>
      <path d="M10 18h28l-3 22H13z" /><path d="M18 18v-3a6 6 0 0 1 12 0v3" /><path d="M14 25h20" />
    </svg>
  ),
  'Daily wear': ( // sun
    <svg viewBox="0 0 48 48" aria-hidden="true" {...L}>
      <circle cx="24" cy="24" r="7" /><path d="M24 6v6M24 36v6M6 24h6M36 24h6M11 11l4 4M33 33l4 4M37 11l-4 4M15 33l-4 4" />
    </svg>
  ),
}
