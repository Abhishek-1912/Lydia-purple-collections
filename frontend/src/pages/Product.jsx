import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ProductGrid } from '../components/ProductCard.jsx'
import { WhatsAppIcon } from '../components/Icons.jsx'
import { useCart } from '../context/CartContext.jsx'
import { api } from '../lib/api.js'
import { rupees, whatsappLink } from '../lib/config.js'
import { productWhatsApp, useStoreRules, useTitle } from '../lib/store.js'
import NotFound from './NotFound.jsx'
import DeliveryCheck from '../components/DeliveryCheck.jsx'
import Gallery from '../components/Gallery.jsx'
import { swatchBg } from '../lib/shades.js'

export default function Product() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { add } = useCart()
  const rules = useStoreRules()
  const [p, setP] = useState(null)
  const [status, setStatus] = useState('loading')
  const [color, setColor] = useState('')
  const [size, setSize] = useState('')
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setStatus('loading')
    api(`/api/products/${slug}`)
      .then((d) => {
        setP(d)
        const firstInStock = d.variants.find((v) => v.stock > 0) || d.variants[0]
        setColor(firstInStock?.color || '')
        setSize(d.sizes.length ? (firstInStock?.size || '') : '')
        setQty(1)
        setStatus('ok')
      })
      .catch((e) => setStatus(e.status === 404 ? 'missing' : 'error'))
  }, [slug])

  useTitle(p?.name, p?.description)

  const variant = useMemo(
    () => p?.variants.find((v) => v.color === color && (!p.sizes.length || v.size === size)),
    [p, color, size]
  )
  const gallery = useMemo(() => {
    if (!p) return []
    const forColor = p.images.filter((i) => !i.color || i.color === color)
    return forColor.length ? forColor : p.images
  }, [p, color])

  if (status === 'loading') return <section className="container section"><div className="pdp skeleton-block" /></section>
  if (status === 'missing') return <NotFound />
  if (status === 'error') return <section className="container section"><p className="alert alert-error">Could not load this product. Please refresh.</p></section>

  const d = p.details || {}
  const specs = [
    ['Fabric', d.composition || p.fabric],
    ['Saree length', d.saree_length],
    ['Saree width', d.saree_width],
    ['Blouse piece', d.blouse_piece],
    ['Weave', d.weave],
    ['Origin', d.origin],
    ['Occasion', d.occasion],
    ['Colour', color || null],
    ['Silk Mark', p.silk_mark ? 'Certified pure silk' : null],
    ['Care', p.care],
  ].filter(([, v]) => v)
  const stock = variant?.stock ?? 0
  const soldOut = !p.in_stock
  const hex = p.colors.find((c) => c.name === color)?.hex
  const sizeStock = (s) => p.variants.find((v) => v.color === color && v.size === s)?.stock ?? 0
  const colorStock = (c) => p.variants.filter((v) => v.color === c).reduce((n, v) => n + v.stock, 0)

  function addToCart() {
    if (!variant || stock < qty) { setMsg(stock ? `Only ${stock} left.` : 'This option is sold out.'); return false }
    add({ variant_id: variant.id, name: p.name, slug: p.slug, color: variant.color, size: variant.size, price: p.price, image: gallery[0]?.url || null }, qty)
    setMsg('')
    return true
  }

  return (
    <>
      <section className="container section">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link> / {p.category && <><Link to={`/collections/${p.category.slug}`}>{p.category.name}</Link> / </>}<span>{p.name}</span>
        </nav>

        <div className="pdp">
          <Gallery images={gallery} alt={`${p.name}${color ? ` in ${color}` : ''}`} hex={hex} />

          <div className="pdp-info">
            <div className="pcard-tags static">
              {p.is_bridal && <span className="tag tag-gold">Bridal</span>}
              {p.is_new && <span className="tag tag-purple">New</span>}
              {p.silk_mark && <span className="tag tag-silk" title="Certified pure silk by the Silk Mark Organisation of India">Silk Mark certified</span>}
              {soldOut && <span className="tag tag-dark">Sold out</span>}
            </div>
            <h1 className="pdp-title">{p.name}</h1>
            <div className="price-row big">
              <span className="price">{rupees(p.price)}</span>
              {p.mrp > p.price && <><s className="mrp">{rupees(p.mrp)}</s><span className="save">Save {p.discount_pct}%</span></>}
            </div>
            <p className="small muted">Inclusive of all taxes</p>

            {p.colors.length > 0 && (
              <fieldset className="opt">
                <legend>Colour: <strong>{color}</strong></legend>
                <div className="swatches">
                  {p.colors.map((c) => (
                    <button key={c.name} type="button" className={`swatch ${c.name === color ? 'active' : ''} ${colorStock(c.name) ? '' : 'out'}`}
                      style={{ background: swatchBg(c.hex, c.hex2) }} onClick={() => setColor(c.name)}
                      aria-label={`${c.name}${colorStock(c.name) ? '' : ' (sold out)'}`} aria-pressed={c.name === color} />
                  ))}
                </div>
              </fieldset>
            )}

            {p.sizes.length > 0 && (
              <fieldset className="opt">
                <legend>Size</legend>
                <div className="sizes">
                  {p.sizes.map((s) => (
                    <button key={s} type="button" className={`size ${s === size ? 'active' : ''}`} onClick={() => setSize(s)}
                      disabled={!sizeStock(s)} aria-pressed={s === size}>{s}</button>
                  ))}
                </div>
              </fieldset>
            )}

            {soldOut ? (
              <a className="btn btn-wa btn-block" href={whatsappLink(`Hi! Please notify me when "${p.name}" is back in stock.\n${window.location.href}`)} target="_blank" rel="noreferrer">
                <WhatsAppIcon /> Notify me on WhatsApp
              </a>
            ) : (
              <>
                {stock > 0 && stock < 4 && <p className="low-stock">Only {stock} left</p>}
                {variant && stock === 0 && <p className="low-stock">This option is sold out — try another colour or size.</p>}
                <div className="qty-row">
                  <label htmlFor="qty" className="sr-only">Quantity</label>
                  <div className="qty">
                    <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease quantity">−</button>
                    <input id="qty" inputMode="numeric" value={qty} readOnly />
                    <button type="button" onClick={() => setQty(Math.min(10, Math.max(1, stock), qty + 1))} aria-label="Increase quantity">+</button>
                  </div>
                  <button className="btn btn-outline grow" disabled={!stock}
                    onClick={() => { if (addToCart()) { setAdded(true); setTimeout(() => setAdded(false), 1800) } }}>
                    {added ? 'Added ✓' : 'Add to cart'}
                  </button>
                </div>
                <button className="btn btn-primary btn-block" disabled={!stock} onClick={() => addToCart() && navigate('/checkout')}>Buy it now</button>
                <a className="btn btn-wa btn-block" href={productWhatsApp(p, variant)} target="_blank" rel="noreferrer">
                  <WhatsAppIcon /> Order on WhatsApp
                </a>
                <div className="pdp-extra">
                  {d.video_url && <a className="link-gold" href={d.video_url} target="_blank" rel="noreferrer">▶ Watch the video</a>}
                  <a className="link-gold" href={whatsappLink(`Hi! Can I see a live video of "${p.name}"${color ? ` in ${color}` : ''}?\n${window.location.href}`)} target="_blank" rel="noreferrer">📹 Ask for a live video call</a>
                </div>
                <DeliveryCheck codAvailable={p.price + rules.cod_fee <= rules.cod_max_order} />
                {msg && <p className="alert alert-error" role="alert">{msg}</p>}
                {added && <p className="small" role="status"><Link to="/cart" className="link-gold">View cart →</Link></p>}
              </>
            )}

            <div className="pdp-details">
              {p.description && <p>{p.description}</p>}
              <h2 className="h-sm">Product details</h2>
              <dl>
                {specs.map(([label, value]) => <div key={label} className="spec"><dt>{label}</dt><dd>{value}</dd></div>)}
                <div className="spec"><dt>Shipping</dt>
                <dd>Free shipping above {rupees(rules.free_shipping_above)}, else {rupees(rules.shipping_fee)}. Ships across India — check your delivery date above. Cash on Delivery available.</dd></div>
              </dl>
              <p className="small muted">Colours may vary slightly on screen. Ask us on WhatsApp for a live video.</p>
            </div>
          </div>
        </div>
      </section>

      {p.related?.length > 0 && (
        <section className="container section">
          <h2 className="section-title">You may also like</h2>
          <ProductGrid products={p.related} />
        </section>
      )}
    </>
  )
}
