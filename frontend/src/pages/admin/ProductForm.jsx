import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuthedApi } from '../../context/AuthContext.jsx'
import { compressImage } from '../../lib/compressImage.js'

const BLANK = { name: '', category_id: '', fabric: '', price: '', mrp: '', description: '', care: '', is_active: true, is_new: true, is_bridal: false, is_clearance: false, sort_order: 0, saree_length: '', saree_width: '', blouse_piece: '', composition: '', weave: '', origin: '', occasion: '', silk_mark: false, video_url: '' }
const DETAIL_KEYS = ['saree_length', 'saree_width', 'blouse_piece', 'composition', 'weave', 'origin', 'occasion', 'video_url']
const newVariant = (v = {}) => ({ key: Math.random().toString(36).slice(2), id: null, color: '', color_hex: '#5E1A73', size: '', sku: '', stock: 0, ...v })

export default function ProductForm() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const call = useAuthedApi()
  const navigate = useNavigate()
  const [cats, setCats] = useState([])
  const [form, setForm] = useState(BLANK)
  const [variants, setVariants] = useState([newVariant()])
  const [images, setImages] = useState([])
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(!isNew)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [upColor, setUpColor] = useState('')
  const [uploading, setUploading] = useState(0)

  useEffect(() => { call('/api/admin/categories').then(setCats).catch(() => {}) }, [call])
  useEffect(() => {
    if (isNew) return
    call(`/api/admin/products/${id}`).then((p) => {
      setForm({ name: p.name, category_id: p.category_id || '', fabric: p.fabric || '', price: p.price, mrp: p.mrp || '', description: p.description || '', care: p.care || '', is_active: p.is_active, is_new: p.is_new, is_bridal: p.is_bridal, is_clearance: p.is_clearance, sort_order: p.sort_order, silk_mark: p.silk_mark, ...Object.fromEntries(Object.entries(p.details).map(([k, v]) => [k, v || ''])) })
      setVariants(p.variants.map((v) => newVariant({ ...v, color_hex: v.color_hex || '#cccccc', sku: v.sku || '' })))
      setImages(p.images)
      setSlug(p.slug)
      setLoading(false)
    }).catch((e) => { setMsg({ type: 'error', text: e.message }); setLoading(false) })
  }, [id, isNew, call])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const setV = (key, k, val) => setVariants((vs) => vs.map((v) => v.key === key ? { ...v, [k]: val } : v))
  const colors = [...new Set(variants.map((v) => v.color.trim()).filter(Boolean))]

  async function save(e) {
    e.preventDefault()
    setMsg({ type: '', text: '' })
    const price = parseInt(form.price, 10), mrp = form.mrp === '' ? null : parseInt(form.mrp, 10)
    if (!form.name.trim()) return setMsg({ type: 'error', text: 'Please enter a product name.' })
    if (!price || price < 1) return setMsg({ type: 'error', text: 'Please enter a price in whole rupees.' })
    if (mrp !== null && mrp < price) return setMsg({ type: 'error', text: 'MRP can’t be lower than the price.' })
    if (form.video_url && !form.video_url.startsWith('https://')) return setMsg({ type: 'error', text: 'Video link must start with https://' })
    if (!variants.length) return setMsg({ type: 'error', text: 'Add at least one variant row.' })
    const body = {
      ...form, price, mrp, category_id: form.category_id || null,
      ...Object.fromEntries(DETAIL_KEYS.map((k) => [k, form[k].trim() || null])), sort_order: parseInt(form.sort_order, 10) || 0,
      variants: variants.map((v) => ({ id: v.id, color: v.color.trim(), color_hex: v.color_hex, size: v.size.trim(), sku: v.sku.trim() || null, stock: Math.max(0, parseInt(v.stock, 10) || 0) })),
    }
    setBusy(true)
    try {
      const p = await call(isNew ? '/api/admin/products' : `/api/admin/products/${id}`, { method: isNew ? 'POST' : 'PUT', body })
      if (isNew) { navigate(`/admin/products/${p.id}`, { replace: true }); return }
      setVariants(p.variants.map((v) => newVariant({ ...v, color_hex: v.color_hex || '#cccccc', sku: v.sku || '' })))
      setSlug(p.slug)
      setMsg({ type: 'ok', text: 'Saved.' })
    } catch (err) { setMsg({ type: 'error', text: err.message }) }
    setBusy(false)
  }

  async function upload(e) {
    const files = [...e.target.files]
    e.target.value = ''
    for (const f of files) {
      setUploading((n) => n + 1)
      let small
      try { small = await compressImage(f) } catch (err) { setMsg({ type: 'error', text: err.message }); setUploading((n) => n - 1); continue }
      const fd = new FormData()
      fd.append('file', small, small.name)
      fd.append('color', upColor)
      try {
        const img = await call(`/api/admin/products/${id}/images`, { method: 'POST', body: fd })
        setImages((all) => [...all, img])
      } catch (err) { setMsg({ type: 'error', text: `${f.name}: ${err.message}` }) }
      setUploading((n) => n - 1)
    }
  }

  async function removeImage(img) {
    if (!window.confirm('Delete this photo?')) return
    await call(`/api/admin/images/${img.id}`, { method: 'DELETE' })
    setImages((all) => all.filter((i) => i.id !== img.id))
  }

  async function retag(img, color) {
    await call(`/api/admin/images/${img.id}`, { method: 'PATCH', body: { color: color || null } })
    setImages((all) => all.map((i) => i.id === img.id ? { ...i, color: color || null } : i))
  }

  async function del() {
    if (!window.confirm('Delete this product for good? Past orders keep their details. To just remove it from the shop, untick “Show in shop” instead.')) return
    await call(`/api/admin/products/${id}`, { method: 'DELETE' })
    navigate('/admin/products', { replace: true })
  }

  if (loading) return <div className="skeleton-block" />

  return (
    <form onSubmit={save} noValidate className="pform">
      <div className="admin-title-row">
        <h1 className="admin-h">{isNew ? 'Add product' : form.name || 'Edit product'}</h1>
        <div className="row-gap">
          {slug && form.is_active && <a className="btn btn-outline btn-sm" href={`/products/${slug}`} target="_blank" rel="noreferrer">View in shop</a>}
          <Link to="/admin/products" className="btn btn-outline btn-sm">Back</Link>
        </div>
      </div>

      <fieldset className="card">
        <legend>Details</legend>
        <div className="field"><label htmlFor="p-name">Name</label><input id="p-name" type="text" value={form.name} onChange={set('name')} /></div>
        <div className="field-row">
          <div className="field"><label htmlFor="p-cat">Category</label>
            <select id="p-cat" value={form.category_id} onChange={set('category_id')}>
              <option value="">Choose…</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_active ? '' : ' (hidden)'}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="p-fab">Fabric</label><input id="p-fab" type="text" value={form.fabric} onChange={set('fabric')} /></div>
        </div>
        <div className="field-row">
          <div className="field"><label htmlFor="p-price">Price (₹)</label><input id="p-price" type="text" inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/\D/g, '') })} /></div>
          <div className="field"><label htmlFor="p-mrp">MRP (₹, optional)</label><input id="p-mrp" type="text" inputMode="numeric" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value.replace(/\D/g, '') })} /></div>
        </div>
        <div className="field"><label htmlFor="p-desc">Description</label><textarea id="p-desc" rows={4} value={form.description} onChange={set('description')} /></div>
        <div className="field"><label htmlFor="p-care">Care</label><input id="p-care" type="text" value={form.care} onChange={set('care')} placeholder="Dry clean only" /></div>
        <div className="flags">
          {[['is_active', 'Show in shop'], ['is_new', 'New arrival'], ['is_bridal', 'Bridal'], ['is_clearance', 'Clearance']].map(([k, l]) => (
            <label key={k} className="check"><input type="checkbox" checked={form[k]} onChange={set(k)} /> {l}</label>
          ))}
        </div>
      </fieldset>

      <fieldset className="card">
        <legend>Specifications</legend>
        <p className="small muted">Shown in a table on the product page. Leave blank what doesn’t apply.</p>
        <div className="field-row">
          <div className="field"><label htmlFor="p-len">Saree length</label><input id="p-len" type="text" value={form.saree_length} onChange={set('saree_length')} placeholder="5.5 m" /></div>
          <div className="field"><label htmlFor="p-wid">Saree width</label><input id="p-wid" type="text" value={form.saree_width} onChange={set('saree_width')} placeholder="1.15 m (45 in)" /></div>
        </div>
        <div className="field"><label htmlFor="p-blouse">Blouse piece</label><input id="p-blouse" type="text" value={form.blouse_piece} onChange={set('blouse_piece')} placeholder="Included · 0.8 m unstitched, contrast border" /></div>
        <div className="field"><label htmlFor="p-comp">Fabric composition</label><input id="p-comp" type="text" value={form.composition} onChange={set('composition')} placeholder="100% pure mulberry silk, pure zari" /></div>
        <div className="field-row">
          <div className="field"><label htmlFor="p-weave">Weave / technique</label><input id="p-weave" type="text" value={form.weave} onChange={set('weave')} placeholder="Handloom, korvai border" /></div>
          <div className="field"><label htmlFor="p-origin">Origin</label><input id="p-origin" type="text" value={form.origin} onChange={set('origin')} placeholder="Kanchipuram, Tamil Nadu" /></div>
        </div>
        <div className="field"><label htmlFor="p-occ">Occasion</label><input id="p-occ" type="text" value={form.occasion} onChange={set('occasion')} placeholder="Weddings, poojas, festivals" /></div>
        <div className="field"><label htmlFor="p-video">Video link (optional)</label><input id="p-video" type="url" value={form.video_url} onChange={set('video_url')} placeholder="https://youtube.com/… or Instagram reel" /></div>
        <label className="check"><input type="checkbox" checked={form.silk_mark} onChange={set('silk_mark')} /> Silk Mark certified (only tick if the saree carries the Silk Mark label)</label>
      </fieldset>

      <fieldset className="card">
        <legend>Variants &amp; stock</legend>
        <p className="small muted">One row per colour (and size, for blouses and kurtis). Leave size blank for sarees.</p>
        <div className="vtable">
          <div className="vrow vhead" aria-hidden="true"><span>Colour</span><span>Swatch</span><span>Size</span><span>SKU</span><span>Stock</span><span /></div>
          {variants.map((v, i) => (
            <div className="vrow" key={v.key}>
              <input aria-label={`Row ${i + 1} colour name`} placeholder="Colour" value={v.color} onChange={(e) => setV(v.key, 'color', e.target.value)} />
              <input aria-label={`Row ${i + 1} swatch colour`} type="color" value={v.color_hex} onChange={(e) => setV(v.key, 'color_hex', e.target.value.toUpperCase())} />
              <input aria-label={`Row ${i + 1} size`} placeholder="—" value={v.size} onChange={(e) => setV(v.key, 'size', e.target.value)} />
              <input aria-label={`Row ${i + 1} SKU`} placeholder="SKU" value={v.sku} onChange={(e) => setV(v.key, 'sku', e.target.value)} />
              <input aria-label={`Row ${i + 1} stock`} inputMode="numeric" value={v.stock} onChange={(e) => setV(v.key, 'stock', e.target.value.replace(/\D/g, ''))} />
              <button type="button" className="icon-btn" aria-label={`Remove row ${i + 1}`} onClick={() => setVariants((vs) => vs.filter((x) => x.key !== v.key))} disabled={variants.length === 1}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setVariants((vs) => [...vs, newVariant({ color: vs.at(-1)?.color || '', color_hex: vs.at(-1)?.color_hex || '#5E1A73' })])}>+ Add row</button>
      </fieldset>

      <fieldset className="card">
        <legend>Photos</legend>
        {isNew ? <p className="muted small">Save the product first, then add photos.</p> : (
          <>
            <div className="upload-row">
              <label className="small">Tag new photos to
                <select value={upColor} onChange={(e) => setUpColor(e.target.value)}>
                  <option value="">All colours</option>
                  {colors.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="btn btn-primary btn-sm file-btn">
                {uploading ? `Uploading ${uploading}…` : 'Upload photos'}
                <input type="file" accept="image/*" multiple onChange={upload} className="sr-only" />
              </label>
            </div>
            <p className="small muted">Any phone photo works — big photos are made smaller automatically. Portrait (3:4) in daylight looks best. First photo is the main one.</p>
            <div className="photo-grid">
              {images.map((img) => (
                <div key={img.id} className="photo">
                  <img src={img.url} alt="" loading="lazy" />
                  <select aria-label="Photo colour" value={img.color || ''} onChange={(e) => retag(img, e.target.value)}>
                    <option value="">All colours</option>
                    {colors.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <button type="button" className="link-btn danger" onClick={() => removeImage(img)}>Delete</button>
                </div>
              ))}
            </div>
          </>
        )}
      </fieldset>

      {msg.text && <p className={`alert ${msg.type === 'ok' ? 'alert-ok' : 'alert-error'}`} role="status">{msg.text}</p>}
      <div className="sticky-save">
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}</button>
        {!isNew && <button type="button" className="link-btn danger" onClick={del}>Delete product</button>}
      </div>
    </form>
  )
}
