import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Stars from './Stars.jsx'
import { useAuth, useAuthedApi } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'
import { compressImage } from '../lib/compressImage.js'

function WriteReview({ slug, onDone }) {
  const call = useAuthedApi()
  const [check, setCheck] = useState(null)
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })
  useEffect(() => { call(`/api/products/${slug}/can-review`).then(setCheck).catch(() => setCheck({ bought: false })) }, [call, slug])

  if (!check) return null
  if (check.already) return <p className="alert alert-ok">Thank you — you’ve reviewed this {check.already === 'pending' ? '(waiting for approval)' : ''}.</p>
  if (!check.bought) return <p className="small muted">Only customers who bought this product can review it.</p>

  async function submit(e) {
    e.preventDefault()
    if (!rating) return setMsg({ type: 'error', text: 'Tap the stars to rate.' })
    if (body.trim().length < 10) return setMsg({ type: 'error', text: 'Please write a few words about the product.' })
    setBusy(true); setMsg({ type: '', text: '' })
    const fd = new FormData()
    fd.append('rating', String(rating)); fd.append('title', title); fd.append('body', body)
    for (const p of photos) fd.append('photos', p, p.name)
    try {
      const r = await call(`/api/products/${slug}/reviews`, { method: 'POST', body: fd })
      setMsg({ type: 'ok', text: r.message }); onDone?.()
      setCheck({ ...check, already: 'pending' })
    } catch (err) { setMsg({ type: 'error', text: err.message }) }
    setBusy(false)
  }

  return (
    <form className="card review-form" onSubmit={submit} noValidate>
      <h3 className="h-sm">Write a review</h3>
      <div className="star-pick" role="radiogroup" aria-label="Your rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className={(hover || rating) >= n ? 'on' : ''} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)}>★</button>
        ))}
      </div>
      <div className="field"><label htmlFor="rv-title">Title (optional)</label><input id="rv-title" type="text" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Beautiful colour, soft silk" /></div>
      <div className="field"><label htmlFor="rv-body">Your review</label><textarea id="rv-body" rows={4} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="How was the fabric, colour and drape? Did it match the photos?" /></div>
      <label className="btn btn-outline btn-sm file-btn">📷 Add photos ({photos.length}/3)
        <input type="file" accept="image/*" multiple className="sr-only" onChange={async (e) => {
          const files = [...e.target.files].slice(0, 3 - photos.length); e.target.value = ''
          const small = []
          for (const f of files) { try { small.push(await compressImage(f)) } catch { /* skip */ } }
          setPhotos((p) => [...p, ...small].slice(0, 3))
        }} />
      </label>
      {photos.length > 0 && <div className="rv-photos">{photos.map((p, i) => <img key={i} src={URL.createObjectURL(p)} alt="" />)}</div>}
      {msg.text && <p className={`alert ${msg.type === 'ok' ? 'alert-ok' : 'alert-error'}`} role="status">{msg.text}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Submit review'}</button>
    </form>
  )
}

/** Reviews section on the product page. */
export default function Reviews({ slug }) {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(false)
  const [zoom, setZoom] = useState(null)
  useEffect(() => { api(`/api/products/${slug}/reviews`).then(setData).catch(() => setData({ summary: { count: 0 }, reviews: [] })) }, [slug])
  if (!data) return null
  const { summary, reviews } = data

  return (
    <section className="container section reviews" id="reviews" aria-labelledby="rv-h">
      <h2 id="rv-h" className="section-title">Customer reviews</h2>
      <div className="rv-layout">
        <div className="rv-summary">
          {summary.count ? (
            <>
              <p className="rv-avg">{summary.average.toFixed(1)}<small>/5</small></p>
              <Stars value={summary.average} size={20} label={false} />
              <p className="small muted">{summary.count} review{summary.count === 1 ? '' : 's'}</p>
              <ul className="rv-bars">
                {[5, 4, 3, 2, 1].map((s) => (
                  <li key={s}><span>{s}★</span><span className="hbar-track"><span className="hbar-fill" style={{ width: `${(summary.stars[s] / summary.count) * 100}%` }} /></span><span className="small">{summary.stars[s]}</span></li>
                ))}
              </ul>
            </>
          ) : <p className="muted">No reviews yet. Bought this saree? Be the first to review it.</p>}
          {user ? (
            !open && <button className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>✍️ Write a review</button>
          ) : <Link to={`/login?next=/products/${slug}%23reviews`} className="btn btn-outline btn-sm">Sign in to review</Link>}
        </div>
        <div className="rv-list">
          {open && user && <WriteReview slug={slug} />}
          {reviews.map((r) => (
            <article key={r.id} className="rv-item">
              <div className="rv-head">
                <Stars value={r.rating} label={false} />
                {r.title && <strong>{r.title}</strong>}
              </div>
              <p className="rv-body">{r.body}</p>
              {r.photos?.length > 0 && (
                <div className="rv-photos">{r.photos.map((u) => <button key={u} type="button" onClick={() => setZoom(u)} aria-label="Open photo"><img src={u} alt="Customer photo" loading="lazy" /></button>)}</div>
              )}
              <p className="small muted">{r.name}{r.verified && <span className="rv-verified"> ✓ Verified buyer</span>} · {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              {r.reply && <p className="rv-reply"><strong>Lydia Purple:</strong> {r.reply}</p>}
            </article>
          ))}
        </div>
      </div>
      {zoom && <div className="gal-full" role="dialog" aria-modal="true" onClick={() => setZoom(null)}><img src={zoom} alt="Customer photo" /><button className="gal-close" aria-label="Close" autoFocus>✕</button></div>}
    </section>
  )
}
