import { Lotus } from './Icons.jsx'

// Shows the photo, or a silk-toned placeholder when no photo is uploaded yet.
export default function ProductImage({ src, alt, hex, eager = false, className = '' }) {
  if (src) {
    return <img className={`pimg ${className}`} src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" />
  }
  const c = hex || '#5E1A73'
  return (
    <div className={`pimg pimg-placeholder ${className}`} role="img" aria-label={alt}
      style={{ background: `linear-gradient(150deg, ${c} 0%, ${c}cc 45%, #2E0B3D 100%)` }}>
      <Lotus size={48} />
    </div>
  )
}
