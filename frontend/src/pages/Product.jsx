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
import Reviews from '../components/Reviews.jsx'
import WishButton from '../components/WishButton.jsx'
import Stars from '../components/Stars.jsx'
import { track } from '../lib/track.js'
import { swatchBg } from '../lib/shades.js'
import { ADDON_CATEGORY, addonLabels, addonPayload, addonPrices, addonTotal, NO_ADDONS, SHAPEWEAR_SIZES } from '../lib/addons.js'

function Choice({ name, value, current, onPick, children }) {
  const on = current === value
  return <button type="button" className={`addon-chip ${on ? 'active' : ''}`} aria-pressed={on} onClick={() => onPick(value)} data-group={name}>{children}</button>
}

const Ico = ({ d }) => <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
const TRUST = {
  ship: <Ico d={<><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.6" /><circle cx="17" cy="17.5" r="1.6" /></>} />,
  pack: <Ico d={<><path d="M12 3 4 7v10l8 4 8-4V7z" /><path d="m4 7 8 4 8-4M12 11v10" /></>} />,
  cod: <Ico d={<><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9v.01M18 15v.01" /></>} />,
  video: <Ico d={<><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>} />,
}

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
  const [addons, setAddons] = useState(NO_ADDONS)

  useEffect(() => {
    setStatus('loading')
    api(`/api/products/${slug}`)
      .then((d) => {
        setP(d)
        track('view', d.id)
        const firstInStock = d.variants.find((v) => v.stock > 0) || d.variants[0]
        setColor(firstInStock?.color || '')
        setSize(d.sizes.length ? (firstInStock?.size || '') : '')
        setQty(1)
        setAddons(NO_ADDONS)
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

  const prices = addonPrices(rules)
  const offerAddons = p.category?.slug === ADDON_CATEGORY && rules.razorpay_enabled && (prices.fall || prices.regular || prices.designer || prices.shapewear)
  const extra = offerAddons ? addonTotal(addons, prices) : 0
  const pick = (k) => (v) => setAddons({ ...addons, [k]: v })

  function addToCart() {
    if (!variant || stock < qty) { setMsg(stock ? `Only ${stock} left.` : 'This option is sold out.'); return false }
    const chosen = offerAddons ? addonPayload(addons) : undefined
    add({ variant_id: variant.id, addons: chosen, name: p.name, slug: p.slug, color: variant.color, size: variant.size, price: p.price + extra, image: gallery[0]?.url || null }, qty)
    track('cart', p.id)
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
          <Gallery images={gallery} alt={`${p.name}${color ? ` in ${color}` : ''}`} hex={hex} video={p.details?.video_url} />

          <div className="pdp-info">
            <div className="pcard-tags static">
              {p.is_bridal && <span className="tag tag-gold">Bridal</span>}
              {p.is_new && <span className="tag tag-purple">New</span>}
              {p.silk_mark && <span className="tag tag-silk" title="Certified pure silk by the Silk Mark Organisation of India">Silk Mark certified</span>}
              {soldOut && <span className="tag tag-dark">Sold out</span>}
            </div>
            <h1 className="pdp-title">{p.name}</h1>
            <div className="pdp-sub">
              {p.rating?.count > 0 && <a href="#reviews" className="pdp-rating"><Stars value={p.rating.average} size={15} label={false} /> {p.rating.average.toFixed(1)} · {p.rating.count} review{p.rating.count === 1 ? '' : 's'}</a>}
              <WishButton product={p} variant="inline" />
            </div>
            <div className="price-row big">
              <span className="price">{rupees(p.price)}</span>
              {p.mrp > p.price && <><s className="mrp">{rupees(p.mrp)}</s><span className="save-pill">Save {rupees(p.mrp - p.price)} ({p.discount_pct}% off)</span></>}
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

            {offerAddons && !soldOut && (
              <div className="addons">
                <p className="addons-head">Make it ready to wear <span>Online payment only</span></p>
                {prices.fall > 0 && (
                  <div className="addon-row" role="group" aria-label="Fall and edging">
                    <span className="addon-name">Fall &amp; edging</span>
                    <div className="addon-chips">
                      <Choice name="fall" value={false} current={addons.fall} onPick={pick('fall')}>No</Choice>
                      <Choice name="fall" value={true} current={addons.fall} onPick={pick('fall')}>Yes <small>+{rupees(prices.fall)}</small></Choice>
                    </div>
                  </div>
                )}
                {(prices.regular > 0 || prices.designer > 0) && (
                  <div className="addon-row" role="group" aria-label="Blouse stitching">
                    <span className="addon-name">Blouse stitching</span>
                    <div className="addon-chips">
                      <Choice name="blouse" value={null} current={addons.blouse} onPick={pick('blouse')}>No</Choice>
                      {prices.regular > 0 && <Choice name="blouse" value="regular" current={addons.blouse} onPick={pick('blouse')}>Regular <small>+{rupees(prices.regular)}</small></Choice>}
                      {prices.designer > 0 && <Choice name="blouse" value="designer" current={addons.blouse} onPick={pick('blouse')}>Designer <small>+{rupees(prices.designer)}</small></Choice>}
                    </div>
                    {addons.blouse && <p className="addon-note">We'll ask for your measurements at checkout.</p>}
                  </div>
                )}
                {prices.shapewear > 0 && (
                  <div className="addon-row" role="group" aria-label="Saree shapewear">
                    <span className="addon-name">Saree shapewear <small>+{rupees(prices.shapewear)}</small></span>
                    <div className="addon-chips">
                      <Choice name="shapewear" value={null} current={addons.shapewear} onPick={pick('shapewear')}>No</Choice>
                      {SHAPEWEAR_SIZES.map((z) => <Choice key={z} name="shapewear" value={z} current={addons.shapewear} onPick={pick('shapewear')}>{z}</Choice>)}
                    </div>
                  </div>
                )}
                {extra > 0 && <p className="addon-total" aria-live="polite">{addonLabels(addons).join(' + ')}: <strong>+{rupees(extra)}</strong> · You pay <strong>{rupees(p.price + extra)}</strong> each</p>}
              </div>
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
                  {rules.call_enabled
                    ? <Link className="link-gold" to={`/video-call?product=${p.slug}`}>📹 Book a video call</Link>
                    : <a className="link-gold" href={whatsappLink(`Hi! Can I see a live video of "${p.name}"${color ? ` in ${color}` : ''}?\n${window.location.href}`)} target="_blank" rel="noreferrer">📹 Ask for a live video call</a>}
                  {!!rules.call_enabled && <a className="link-gold" href={whatsappLink(`Hi! Can I see a live video of "${p.name}"${color ? ` in ${color}` : ''}?\n${window.location.href}`)} target="_blank" rel="noreferrer">💬 Or ask on WhatsApp</a>}
                </div>
                <DeliveryCheck codAvailable={!extra && p.price + rules.cod_fee <= rules.cod_max_order} />
                {msg && <p className="alert alert-error" role="alert">{msg}</p>}
                {added && <p className="small" role="status"><Link to="/cart" className="link-gold">View cart →</Link></p>}
              </>
            )}

            <ul className="trust-row">
              <li>{TRUST.ship}<span><strong>Free shipping</strong> above {rupees(rules.free_shipping_above)}</span></li>
              <li>{TRUST.pack}<span><strong>{rules.dispatch_days > 1 ? `Ships in ${rules.dispatch_days} days` : rules.dispatch_days === 1 ? 'Ships in 1 day' : 'Ships fast'}</strong> across India</span></li>
              <li>{TRUST.cod}<span><strong>Cash on Delivery</strong> available</span></li>
              <li>{TRUST.video}<span><strong>Live video</strong> before you buy</span></li>
            </ul>

            <div className="pdp-acc">
              {p.description && <details open><summary>Description</summary><p>{p.description}</p></details>}
              {(d.composition || p.fabric || d.weave || d.origin || p.silk_mark) && (
                <details><summary>Fabric &amp; craft</summary>
                  <p>{[d.composition || p.fabric, d.weave && `${d.weave} weave`, d.origin && `from ${d.origin}`].filter(Boolean).join(', ')}.{p.silk_mark && ' Silk Mark certified pure silk.'}</p>
                </details>
              )}
              {d.occasion && <details><summary>Occasion</summary><p>{d.occasion}</p></details>}
              {p.care && <details><summary>Care</summary><p>{p.care}</p></details>}
              <details><summary>Product details</summary>
                <dl>{specs.filter(([l]) => l !== 'Care').map(([label, value]) => <div key={label} className="spec"><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
                <p className="small muted">Colours may vary slightly on screen. Ask us on WhatsApp for a live video.</p>
              </details>
              <details><summary>Shipping &amp; payment</summary>
                <p>Free shipping above {rupees(rules.free_shipping_above)}, otherwise {rupees(rules.shipping_fee)}. Ships across India — check your delivery date above. Pay online by UPI, card or net banking, or Cash on Delivery (+{rupees(rules.cod_fee)}).{offerAddons ? ' Orders with fall & edging, blouse stitching or shapewear are online payment only.' : ''}</p>
              </details>
            </div>
          </div>
        </div>
      </section>

      <Reviews slug={p.slug} />

      {p.related?.length > 0 && (
        <section className="container section">
          <h2 className="section-title">You may also like</h2>
          <ProductGrid products={p.related} />
        </section>
      )}
    </>
  )
}
