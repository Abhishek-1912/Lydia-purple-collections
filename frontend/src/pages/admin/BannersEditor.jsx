import { useState } from 'react'
import { useAuthedApi } from '../../context/AuthContext.jsx'
import { compressImage } from '../../lib/compressImage.js'

const LINKS = [['/shop', 'All products'], ['/collections/sarees', 'Sarees'], ['/collections/ethnic-wear', 'Ethnic wear'], ['/bridal', 'Bridal'], ['/new-arrivals', 'New arrivals'], ['/clearance', 'Clearance'], ['/contact', 'Contact']]

const size = (file) => new Promise((res) => {
  const img = new Image()
  img.onload = () => { res({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(img.src) }
  img.onerror = () => res({ w: 0, h: 0 })
  img.src = URL.createObjectURL(file)
})

// Home page banner slides (shown after the main purple slide). Saved with "Save settings".
export default function BannersEditor({ banners = [], onChange }) {
  const call = useAuthedApi()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function upload(e) {
    const files = [...e.target.files]
    e.target.value = ''
    setError('')
    let list = [...banners]
    for (const f of files) {
      if (list.length >= 8) { setError('Up to 8 banners.'); break }
      setBusy(`Uploading ${f.name}…`)
      try {
        const sharp = await compressImage(f, 2400, 0.9) // keep banners sharp on big screens
        const { w, h } = await size(sharp)
        if (w && w < 1200) setError(`${f.name} is only ${w} px wide and may look blurry. Best size: 1920 × 850 px.`)
        const fd = new FormData()
        fd.append('file', sharp, sharp.name)
        const { url } = await call('/api/admin/banners', { method: 'POST', body: fd })
        list = [...list, { url, link: '/shop', alt: '', w, h }]
        onChange(list)
      } catch (err) { setError(err.message) }
    }
    setBusy('')
  }

  const update = (i, patch) => onChange(banners.map((b, k) => (k === i ? { ...b, ...patch } : b)))
  const move = (i, d) => {
    const j = i + d
    if (j < 0 || j >= banners.length) return
    const next = [...banners]; [next[i], next[j]] = [next[j], next[i]]; onChange(next)
  }

  return (
    <fieldset className="card">
      <legend>Home page banners</legend>
      <p className="small muted">
        Extra slides on the home page, after the main purple slide. Use wide photos — best <strong>1920 × 850 px</strong>
        (text can be part of the photo). Shown sharp and uncut on every screen. Only use photos you own.
      </p>
      {banners.length > 0 && (
        <ul className="banner-list">
          {banners.map((b, i) => (
            <li key={b.url}>
              <img src={b.url} alt="" />
              <div className="banner-fields">
                <label className="small">“Shop now” opens
                  <select value={b.link} onChange={(e) => update(i, { link: e.target.value })}>
                    {LINKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    {!LINKS.some(([v]) => v === b.link) && <option value={b.link}>{b.link}</option>}
                  </select>
                </label>
                <label className="small">What’s in the photo (for blind shoppers & Google)
                  <input type="text" value={b.alt} maxLength={120} placeholder="Model in purple Banarasi saree" onChange={(e) => update(i, { alt: e.target.value })} />
                </label>
                <div className="row-gap">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => move(i, 1)} disabled={i === banners.length - 1} aria-label="Move down">↓</button>
                  <button type="button" className="btn btn-outline btn-sm danger" onClick={() => onChange(banners.filter((_, k) => k !== i))}>Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="alert alert-error">{error}</p>}
      <label className="btn btn-primary btn-sm file-btn">
        {busy || '➕ Upload banner photo'}
        <input type="file" accept="image/*" multiple onChange={upload} className="sr-only" disabled={!!busy} />
      </label>
      {banners.length > 0 && <p className="small muted" style={{ marginTop: 8 }}>Remember to press <strong>Save settings</strong> below.</p>}
    </fieldset>
  )
}
