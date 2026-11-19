import { useState } from 'react'
import { useAuthedApi } from '../../context/AuthContext.jsx'
import { compressImage } from '../../lib/compressImage.js'
import HeroMain, { HERO_DEFAULTS } from '../../components/HeroMain.jsx'

const LINKS = [['/collections/sarees', 'Sarees'], ['/bridal', 'Bridal'], ['/new-arrivals', 'New arrivals'], ['/shop', 'All products'], ['/collections/ethnic-wear', 'Ethnic wear'], ['/clearance', 'Clearance'], ['/contact', 'Contact']]

// Edit the main (first) home slide: background, text, buttons. Saved with "Save settings".
export default function HeroEditor({ hero = {}, seconds = 2, onChange, onSeconds }) {
  const call = useAuthedApi()
  const h = { ...HERO_DEFAULTS, ...hero }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => onChange({ ...h, ...patch })

  async function upload(e) {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    setBusy(true); setError('')
    try {
      const img = await compressImage(f, 2400, 0.88)
      const fd = new FormData()
      fd.append('file', img, img.name)
      const { url } = await call('/api/admin/banners', { method: 'POST', body: fd })
      set({ bg: 'photo', bg_url: url })
    } catch (err) { setError(err.message) }
    setBusy(false)
  }

  const text = (key, label, max, rows) => (
    <div className="field">
      <label htmlFor={`hero-${key}`}>{label}</label>
      {rows ? <textarea id={`hero-${key}`} rows={rows} maxLength={max} value={h[key]} onChange={(e) => set({ [key]: e.target.value })} />
        : <input id={`hero-${key}`} type="text" maxLength={max} value={h[key]} onChange={(e) => set({ [key]: e.target.value })} />}
    </div>
  )

  return (
    <fieldset className="card">
      <legend>Main slide (home page)</legend>
      <p className="small muted">This is the first slide customers see. Preview:</p>
      <div className="hero-preview-box" aria-hidden="true"><HeroMain hero={h} preview /></div>

      <h3 className="h-sm">Background</h3>
      <div className="easy-chips">
        {[['design', '💜 Purple design'], ['photo', '📷 Photo'], ['colour', '🎨 Colour']].map(([v, l]) => (
          <button key={v} type="button" className={`easy-chip sm ${h.bg === v ? 'on' : ''}`} onClick={() => set({ bg: v })}>{l}</button>
        ))}
      </div>
      {h.bg === 'photo' && (
        <div className="hero-bg-row">
          <label className="btn btn-primary btn-sm file-btn">
            {busy ? 'Uploading…' : h.bg_url ? 'Change photo' : 'Upload background photo'}
            <input type="file" accept="image/*" onChange={upload} className="sr-only" disabled={busy} />
          </label>
          <label className="small range">Darken photo (so text is readable): {h.dark}%
            <input type="range" min="0" max="80" step="5" value={h.dark} onChange={(e) => set({ dark: Number(e.target.value) })} />
          </label>
          <p className="small muted">Wide photo works best (1920 × 850). Keep the left side plain — the text sits there.</p>
        </div>
      )}
      {h.bg === 'colour' && (
        <label className="small hero-colour">Colour <input type="color" value={h.bg_colour} onChange={(e) => set({ bg_colour: e.target.value.toUpperCase() })} /></label>
      )}
      <label className="check"><input type="checkbox" checked={h.mandala} onChange={(e) => set({ mandala: e.target.checked })} /> Show gold mandala</label>

      <h3 className="h-sm">Text</h3>
      {text('eyebrow', 'Small top line', 80)}
      {text('title', 'Big heading (press Enter for a new line)', 90, 2)}
      {text('subtitle', 'Line under the heading', 200, 2)}
      <div className="field-row">
        {text('btn1', 'Gold button text', 30)}
        <div className="field"><label htmlFor="hero-b1l">Gold button opens</label>
          <select id="hero-b1l" value={h.btn1_link} onChange={(e) => set({ btn1_link: e.target.value })}>{LINKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      </div>
      <div className="field-row">
        {text('btn2', 'Second button text (blank = hide)', 30)}
        <div className="field"><label htmlFor="hero-b2l">Second button opens</label>
          <select id="hero-b2l" value={h.btn2_link} onChange={(e) => set({ btn2_link: e.target.value })}>{LINKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="row-gap">
        <button type="button" className="link-btn" onClick={() => onChange({ ...HERO_DEFAULTS })}>Reset to original design</button>
      </div>

      <h3 className="h-sm">Slider speed</h3>
      <label className="small range">Seconds per slide: <strong>{seconds}</strong>
        <input type="range" min="2" max="10" step="1" value={seconds} onChange={(e) => onSeconds(Number(e.target.value))} />
      </label>
      <p className="small muted">Slides change automatically and pause while a customer is touching or pointing at them.</p>
    </fieldset>
  )
}
