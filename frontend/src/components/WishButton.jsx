import { useState } from 'react'
import { useWishlist } from '../context/WishlistContext.jsx'

export function HeartIcon({ filled, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
      <path d="M12 20s-7-4.4-9.2-8.6C1.2 8.3 3 5 6.4 5c2 0 3.3 1.1 4.1 2.3.4.6 2.6.6 3 0C14.3 6.1 15.6 5 17.6 5 21 5 22.8 8.3 21.2 11.4 19 15.6 12 20 12 20z" />
    </svg>
  )
}

/** ❤ toggle for a product. variant: 'float' (on photos) or 'inline' (next to a title). */
export default function WishButton({ product, variant = 'float' }) {
  const { has, toggle } = useWishlist()
  const on = has(product.id)
  const [pop, setPop] = useState(false)
  return (
    <button type="button" className={`wish ${variant} ${on ? 'on' : ''} ${pop ? 'pop' : ''}`} aria-pressed={on}
      aria-label={on ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
      onClick={async (e) => { e.preventDefault(); e.stopPropagation(); const added = await toggle(product.id); if (added) { setPop(true); setTimeout(() => setPop(false), 400) } }}>
      <HeartIcon filled={on} />
      {variant === 'inline' && <span>{on ? 'Saved' : 'Save'}</span>}
    </button>
  )
}
