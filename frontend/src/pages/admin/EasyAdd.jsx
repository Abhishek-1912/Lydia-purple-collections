import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthedApi } from '../../context/AuthContext.jsx'
import { compressImage } from '../../lib/compressImage.js'
import { rupees } from '../../lib/config.js'
import { COLOURS, KINDS, OTHER_DETAILS, SAREE_TYPES, SIZES } from '../../lib/presets.js'

// Easy Add: one question per screen, big buttons, no typing except price.
const STEPS = ['Photos', 'Type', 'Price', 'Colours', 'Match', 'Save']
const swatchStyle = (hex) => ({ background: hex === 'linear' ? 'conic-gradient(red, orange, yellow, green, blue, purple, red)' : hex })

const fresh = () => ({ photos: [], kind: null, type: null, price: '', mrp: '', colours: [], sizes: [], stock: {}, name: '', nameEdited: false, isNew: true, bridal: false })

export default function EasyAdd() {
  const call = useAuthedApi()
  const [s, setS] = useState(fresh)
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const [cats, setCats] = useState([])
  const camRef = useRef(null), galRef = useRef(null)
  const set = (patch) => setS((x) => ({ ...x, ...patch }))

  useEffect(() => { call('/api/admin/categories').then(setCats).catch(() => {}) }, [call])

  const kind = KINDS.find((k) => k.id === s.kind)
  const type = SAREE_TYPES.find((t) => t.id === s.type)
  const sized = kind?.sized
  const multi = s.colours.length > 1
  const keys = useMemo(() => s.colours.flatMap((c) => (sized ? s.sizes : ['']).map((z) => `${c.name}|${z}`)), [s.colours, s.sizes, sized])
  const totalStock = keys.reduce((n, k) => n + (s.stock[k] ?? 1), 0)

  const suggestedName = useMemo(() => {
    const colour = s.colours.length === 1 ? s.colours[0].name + ' ' : ''
    if (s.kind === 'saree') {
      const label = type && type.id !== 'other' ? type.label.split(' /')[0] : ''
      const silk = type?.fabric?.toLowerCase().includes('silk') && !label.toLowerCase().includes('silk') ? ' Silk' : ''
      return `${colour}${label}${silk} Saree`.replace(/\s+/g, ' ').trim()
    }
    return `${colour}${kind?.label.split(' /')[0] || 'Product'}`.trim()
  }, [s.colours, s.kind, type, kind])
  const name = s.nameEdited ? s.name : suggestedName

  async function addPhotos(e) {
    const files = [...e.target.files]
    e.target.value = ''
    setError('')
    for (const f of files) {
      setBusy(`Preparing photo ${files.indexOf(f) + 1} of ${files.length}…`)
      try {
        const small = await compressImage(f)
        setS((x) => ({ ...x, photos: [...x.photos, { id: Math.random().toString(36).slice(2), file: small, url: URL.createObjectURL(small), colour: null }] }))
      } catch (err) { setError(err.message) }
    }
    setBusy('')
  }

  function toggleColour(name, hex) {
    setS((x) => {
      const on = x.colours.some((c) => c.name === name)
      return { ...x, colours: on ? x.colours.filter((c) => c.name !== name) : [...x.colours, { name, hex }] }
    })
  }
  const toggleSize = (z) => setS((x) => ({ ...x, sizes: x.sizes.includes(z) ? x.sizes.filter((y) => y !== z) : [...x.sizes, z] }))
  const bump = (k, d) => setS((x) => ({ ...x, stock: { ...x.stock, [k]: Math.max(0, Math.min(999, (x.stock[k] ?? 1) + d)) } }))

  const priceN = parseInt(s.price, 10) || 0, mrpN = parseInt(s.mrp, 10) || 0
  const canNext = [
    s.photos.length > 0,
    !!kind && (s.kind !== 'saree' || !!type),
    priceN > 0 && (!mrpN || mrpN >= priceN),
    s.colours.length > 0 && (!sized || s.sizes.length > 0),
    true,
    name.trim().length >= 3,
  ][step]
  const hint = ['Add at least one photo', s.kind === 'saree' && kind ? 'Tap the saree type' : 'Tap what you are adding', mrpN && mrpN < priceN ? 'Original price must be more than selling price' : 'Enter the selling price', sized && !s.sizes.length && s.colours.length ? 'Tap at least one size' : 'Tap at least one colour', '', 'Enter a name'][step]

  function next() {
    if (!canNext) return
    let n = step + 1
    if (n === 4 && !multi) n = 5 // only one colour → no photo matching needed
    setStep(n)
    window.scrollTo(0, 0)
  }
  function back() {
    let n = step - 1
    if (n === 4 && !multi) n = 3
    setStep(Math.max(0, n))
  }

  async function save() {
    setError('')
    const details = s.kind === 'saree' ? type : OTHER_DETAILS[s.kind]
    const cat = cats.find((c) => c.slug === kind.category)
    const body = {
      name: name.trim(),
      category_id: cat?.id || null,
      fabric: details.fabric || null,
      description: s.kind === 'saree'
        ? `Beautiful ${type.id === 'other' ? '' : type.label + ' '}saree${s.colours.length ? ` in ${s.colours.map((c) => c.name).join(', ')}` : ''}. Message us on WhatsApp for a live video or more photos.`
        : `${kind.label}${s.colours.length ? ` in ${s.colours.map((c) => c.name).join(', ')}` : ''}. Message us on WhatsApp for size help or a live video.`,
      care: details.care || null,
      price: priceN, mrp: mrpN || null,
      is_active: true, is_new: s.isNew, is_bridal: s.bridal, is_clearance: false, sort_order: 0,
      saree_length: details.saree_length || null, saree_width: details.saree_width || null, blouse_piece: details.blouse_piece || null,
      composition: details.composition || null, weave: details.weave || null, origin: details.origin || null, occasion: details.occasion || null,
      silk_mark: false, video_url: null,
      variants: keys.map((k) => {
        const [colour, size] = k.split('|')
        const hex = s.colours.find((c) => c.name === colour)?.hex
        return { color: colour, color_hex: hex && hex !== 'linear' ? hex.toUpperCase() : '', size, sku: null, stock: s.stock[k] ?? 1 }
      }),
    }
    try {
      setBusy('Saving product…')
      const p = await call('/api/admin/products', { method: 'POST', body })
      const failed = []
      for (let i = 0; i < s.photos.length; i++) {
        setBusy(`Uploading photo ${i + 1} of ${s.photos.length}…`)
        const ph = s.photos[i]
        const fd = new FormData()
        fd.append('file', ph.file, ph.file.name)
        fd.append('color', multi ? (ph.colour || '') : '')
        try { await call(`/api/admin/products/${p.id}/images`, { method: 'POST', body: fd }) } catch { failed.push(i + 1) }
      }
      setDone({ product: p, failed, hiddenCategory: cat && !cat.is_active ? cat.name : null })
    } catch (err) { setError(err.message) }
    setBusy('')
  }

  function restart(similar) {
    s.photos.forEach((p) => URL.revokeObjectURL(p.url))
    setS(similar ? { ...fresh(), kind: s.kind, type: s.type, price: s.price, mrp: s.mrp, sizes: s.sizes, bridal: s.bridal } : fresh())
    setStep(0); setDone(null); setError('')
    window.scrollTo(0, 0)
  }

  // ─────────── success screen ───────────
  if (done) {
    return (
      <div className="easy">
        <div className="easy-done">
          <div className="easy-big">✅</div>
          <h1 className="admin-h">Product added!</h1>
          <p><strong>{done.product.name}</strong> · {rupees(done.product.price)}</p>
          {done.failed.length > 0 && <p className="alert alert-error">Photo {done.failed.join(', ')} didn’t upload. Open the product to add it again.</p>}
          {done.hiddenCategory && <p className="alert alert-error">The “{done.hiddenCategory}” category is hidden, so customers can’t see this yet. Switch it on in Admin → Categories.</p>}
          <button className="btn btn-primary easy-btn" onClick={() => restart(true)}>➕ Add similar (same type &amp; price)</button>
          <button className="btn btn-outline easy-btn" onClick={() => restart(false)}>➕ Add a different product</button>
          <a className="btn btn-outline easy-btn" href={`/products/${done.product.slug}`} target="_blank" rel="noreferrer">👁 See it in the shop</a>
          <Link className="link-gold" to={`/admin/products/${done.product.id}`}>Edit more details</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="easy">
      <div className="easy-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((t, i) => <span key={t} className={i <= step ? 'on' : ''} />)}
      </div>

      {/* 1. PHOTOS */}
      {step === 0 && (
        <section>
          <h1 className="easy-q">📷 Add photos</h1>
          <p className="easy-help">Take photos in daylight. First photo = main photo.</p>
          <div className="easy-two">
            <button className="easy-tile" onClick={() => camRef.current.click()}><span className="easy-big">📸</span>Take photo</button>
            <button className="easy-tile" onClick={() => galRef.current.click()}><span className="easy-big">🖼️</span>From gallery</button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={addPhotos} hidden />
          <input ref={galRef} type="file" accept="image/*" multiple onChange={addPhotos} hidden />
          {s.photos.length > 0 && (
            <div className="easy-photos">
              {s.photos.map((p, i) => (
                <div key={p.id} className="easy-photo">
                  <img src={p.url} alt={`Photo ${i + 1}`} />
                  {i === 0 && <span className="easy-main">Main</span>}
                  <button aria-label={`Remove photo ${i + 1}`} onClick={() => { URL.revokeObjectURL(p.url); set({ photos: s.photos.filter((x) => x.id !== p.id) }) }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 2. TYPE */}
      {step === 1 && (
        <section>
          <h1 className="easy-q">What are you adding?</h1>
          <div className="easy-grid">
            {KINDS.map((k) => (
              <button key={k.id} className={`easy-tile ${s.kind === k.id ? 'on' : ''}`} onClick={() => set({ kind: k.id, type: k.id === 'saree' ? s.type : null, sizes: k.sized ? (s.sizes.length ? s.sizes : []) : [] })}>
                <span className="easy-big">{k.emoji}</span>{k.label}
              </button>
            ))}
          </div>
          {s.kind === 'saree' && (
            <>
              <h2 className="easy-q2">Which saree?</h2>
              <div className="easy-chips">
                {SAREE_TYPES.map((t) => (
                  <button key={t.id} className={`easy-chip ${s.type === t.id ? 'on' : ''}`} onClick={() => set({ type: t.id, bridal: !!t.bridal })}>{t.label}</button>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* 3. PRICE */}
      {step === 2 && (
        <section>
          <h1 className="easy-q">💰 Price</h1>
          <label className="easy-label" htmlFor="ea-price">Selling price</label>
          <div className="easy-money"><span>₹</span><input id="ea-price" inputMode="numeric" autoFocus value={s.price} onChange={(e) => set({ price: e.target.value.replace(/\D/g, '').slice(0, 7) })} placeholder="0" /></div>
          <label className="easy-label" htmlFor="ea-mrp">Original price <small>(optional — shows a discount)</small></label>
          <div className="easy-money small"><span>₹</span><input id="ea-mrp" inputMode="numeric" value={s.mrp} onChange={(e) => set({ mrp: e.target.value.replace(/\D/g, '').slice(0, 7) })} placeholder="—" /></div>
          {mrpN > priceN && priceN > 0 && <p className="easy-help save">Customers see {Math.round(((mrpN - priceN) / mrpN) * 100)}% off</p>}
        </section>
      )}

      {/* 4. COLOURS + STOCK */}
      {step === 3 && (
        <section>
          <h1 className="easy-q">🎨 Colours</h1>
          <p className="easy-help">Tap every colour you have.</p>
          <div className="easy-colours">
            {COLOURS.map(([n, hex]) => {
              const on = s.colours.some((c) => c.name === n)
              return (
                <button key={n} className={`easy-colour ${on ? 'on' : ''}`} onClick={() => toggleColour(n, hex)} aria-pressed={on}>
                  <span className="dot" style={swatchStyle(hex)} />{n}
                </button>
              )
            })}
          </div>
          {sized && (
            <>
              <h2 className="easy-q2">Sizes</h2>
              <div className="easy-chips">{SIZES.map((z) => <button key={z} className={`easy-chip ${s.sizes.includes(z) ? 'on' : ''}`} onClick={() => toggleSize(z)}>{z}</button>)}</div>
            </>
          )}
          {keys.length > 0 && (
            <>
              <h2 className="easy-q2">How many pieces?</h2>
              <ul className="easy-stock">
                {keys.map((k) => {
                  const [colour, size] = k.split('|')
                  const hex = s.colours.find((c) => c.name === colour)?.hex
                  return (
                    <li key={k}>
                      <span className="dot" style={swatchStyle(hex)} /><span className="grow">{colour}{size && ` · ${size}`}</span>
                      <button aria-label={`Fewer ${colour} ${size}`} onClick={() => bump(k, -1)}>−</button>
                      <strong>{s.stock[k] ?? 1}</strong>
                      <button aria-label={`More ${colour} ${size}`} onClick={() => bump(k, 1)}>+</button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </section>
      )}

      {/* 5. MATCH PHOTOS TO COLOURS */}
      {step === 4 && (
        <section>
          <h1 className="easy-q">Which colour is each photo?</h1>
          <p className="easy-help">Tap the colour under each photo. Leave “All” if it shows every colour.</p>
          <div className="easy-match">
            {s.photos.map((p, i) => (
              <div key={p.id} className="easy-match-item">
                <img src={p.url} alt={`Photo ${i + 1}`} />
                <div className="easy-match-dots">
                  <button className={!p.colour ? 'on all' : 'all'} onClick={() => set({ photos: s.photos.map((x) => x.id === p.id ? { ...x, colour: null } : x) })}>All</button>
                  {s.colours.map((c) => (
                    <button key={c.name} className={p.colour === c.name ? 'on' : ''} aria-label={c.name} title={c.name}
                      onClick={() => set({ photos: s.photos.map((x) => x.id === p.id ? { ...x, colour: c.name } : x) })}>
                      <span className="dot" style={swatchStyle(c.hex)} />
                    </button>
                  ))}
                </div>
                <small>{p.colour || 'All colours'}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. NAME + SAVE */}
      {step === 5 && (
        <section>
          <h1 className="easy-q">✏️ Name</h1>
          <label className="easy-label" htmlFor="ea-name">Product name <small>(change if you like)</small></label>
          <input id="ea-name" className="easy-input" value={name} onChange={(e) => set({ name: e.target.value, nameEdited: true })} />
          <div className="easy-toggles">
            <button className={`easy-chip ${s.isNew ? 'on' : ''}`} onClick={() => set({ isNew: !s.isNew })}>{s.isNew ? '✓ ' : ''}Show in New Arrivals</button>
            <button className={`easy-chip ${s.bridal ? 'on' : ''}`} onClick={() => set({ bridal: !s.bridal })}>{s.bridal ? '✓ ' : ''}Bridal</button>
          </div>
          <div className="easy-summary card">
            {s.photos[0] && <img src={s.photos[0].url} alt="" />}
            <div>
              <strong>{name}</strong>
              <p>{rupees(priceN)}{mrpN > priceN && <s> {rupees(mrpN)}</s>}</p>
              <p className="small muted">{s.colours.map((c) => c.name).join(', ')}{sized && ` · ${s.sizes.join(', ')}`} · {totalStock} pieces · {s.photos.length} photo{s.photos.length === 1 ? '' : 's'}</p>
            </div>
          </div>
        </section>
      )}

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {busy && <p className="easy-busy" role="status">⏳ {busy}</p>}

      <div className="easy-nav">
        {step > 0 && <button className="btn btn-outline easy-btn" onClick={back} disabled={!!busy}>← Back</button>}
        {step < 5
          ? <button className="btn btn-primary easy-btn" onClick={next} disabled={!canNext || !!busy}>Next →</button>
          : <button className="btn btn-primary easy-btn" onClick={save} disabled={!canNext || !!busy}>✅ Save</button>}
      </div>
      {!canNext && hint && <p className="easy-hint">{hint}</p>}
    </div>
  )
}
