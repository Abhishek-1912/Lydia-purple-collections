import { useState } from 'react'
import { Link } from 'react-router-dom'
import ProductImage from './ProductImage.jsx'
import { WhatsAppIcon } from './Icons.jsx'
import WishButton from './WishButton.jsx'
import Stars from './Stars.jsx'
import { useCart } from '../context/CartContext.jsx'
import { rupees } from '../lib/config.js'
import { productWhatsApp } from '../lib/store.js'

export default function ProductCard({ product: p }) {
  const { add } = useCart()
  const [added, setAdded] = useState(false)
  const single = p.variants.length === 1 ? p.variants[0] : null
  const firstImg = p.images[0]
  const url = `/products/${p.slug}`

  function addSingle() {
    add({ variant_id: single.id, name: p.name, slug: p.slug, color: single.color, size: single.size, price: p.price, image: firstImg?.url || null })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <article className="pcard">
      <Link to={url} className="pcard-media" tabIndex={-1} aria-hidden="true">
        <ProductImage src={firstImg?.url} alt="" hex={p.colors[0]?.hex} />
        {p.images[1] && <img className="pimg pcard-alt" src={p.images[1].url} alt="" loading="lazy" decoding="async" />}
        <WishButton product={p} />
        <div className="pcard-tags">
          {!p.in_stock ? <span className="tag tag-dark">Sold out</span>
            : p.discount_pct > 0 && <span className="tag tag-sale">{p.discount_pct}% off</span>}
          {p.is_bridal && <span className="tag tag-gold">Bridal</span>}
        </div>
      </Link>
      <div className="pcard-body">
        <h3 className="pcard-title"><Link to={url}>{p.name}</Link></h3>
        <div className="price-row">
          <span className="price">{rupees(p.price)}</span>
          {p.mrp > p.price && <s className="mrp" aria-label={`MRP ${rupees(p.mrp)}`}>{rupees(p.mrp)}</s>}
        </div>
        {p.rating?.count > 0 && <p className="pcard-rating"><Stars value={p.rating.average} size={12} label={false} /> <span>{p.rating.average.toFixed(1)} ({p.rating.count})</span></p>}
        {p.colors.length > 1 && <p className="pcard-meta">{p.colors.length} colours</p>}
        <div className="pcard-actions">
          {!p.in_stock ? <Link to={url} className="btn btn-outline btn-sm">View</Link>
            : single ? <button className="btn btn-primary btn-sm" onClick={addSingle} disabled={single.stock < 1}>{added ? 'Added ✓' : 'Add to cart'}</button>
            : <Link to={url} className="btn btn-primary btn-sm">Choose options</Link>}
          <a className="btn btn-wa btn-sm btn-icon" href={productWhatsApp(p)} target="_blank" rel="noreferrer" aria-label={`Order ${p.name} on WhatsApp`}>
            <WhatsAppIcon size={18} />
          </a>
        </div>
      </div>
    </article>
  )
}

export function ProductGrid({ products, loading, empty = 'No products found.' }) {
  if (loading) return <div className="pgrid">{Array.from({ length: 4 }, (_, i) => <div key={i} className="pcard skeleton" />)}</div>
  if (!products.length) return <p className="muted">{empty}</p>
  return <div className="pgrid">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
}
