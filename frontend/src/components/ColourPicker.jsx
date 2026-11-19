import { useEffect, useRef, useState } from 'react'
import { MULTI, SHADE_FAMILIES, nearestShades, swatchBg, toHex } from '../lib/shades.js'

// Two ways to choose a colour: tap the saree in a photo (exact shade), or pick from the shade book.
// onPick({ name, hex })
export default function ColourPicker({ photos = [], onPick, onCancel, title = 'Add a colour' }) {
  const [tab, setTab] = useState(photos.length ? 'photo' : 'book')
  const [photoIdx, setPhotoIdx] = useState(0)
  const [picked, setPicked] = useState(null) // { hex, x, y }
  const [name, setName] = useState('')
  const canvasRef = useRef(null)

  // draw the chosen photo on a canvas we can read pixels from
  useEffect(() => {
    if (tab !== 'photo' || !photos[photoIdx]) return
    const img = new Image()
    img.onload = () => {
      const c = canvasRef.current
      if (!c) return
      const w = Math.min(520, c.parentElement.clientWidth)
      c.width = w
      c.height = Math.round((img.height / img.width) * w)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    }
    img.src = photos[photoIdx].url
    setPicked(null)
  }, [tab, photoIdx, photos])

  function sample(e) {
    const c = canvasRef.current
    const rect = c.getBoundingClientRect()
    const pt = e.touches?.[0] || e
    const x = Math.round(((pt.clientX - rect.left) / rect.width) * c.width)
    const y = Math.round(((pt.clientY - rect.top) / rect.height) * c.height)
    const r = 4, x0 = Math.max(0, x - r), y0 = Math.max(0, y - r)
    const d = c.getContext('2d').getImageData(x0, y0, Math.min(c.width - x0, r * 2 + 1), Math.min(c.height - y0, r * 2 + 1)).data
    let R = 0, G = 0, B = 0, n = 0
    for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++ }
    const hex = toHex(R / n, G / n, B / n)
    setPicked({ hex, x: (x / c.width) * 100, y: (y / c.height) * 100 })
    setName(nearestShades(hex, 1)[0][0])
  }

  return (
    <div className="cpick card">
      <div className="cpick-head">
        <strong>{title}</strong>
        {onCancel && <button type="button" className="link-btn" onClick={onCancel}>Cancel</button>}
      </div>
      <div className="cpick-tabs" role="tablist">
        {photos.length > 0 && <button type="button" role="tab" aria-selected={tab === 'photo'} className={tab === 'photo' ? 'on' : ''} onClick={() => setTab('photo')}>📷 Tap on photo</button>}
        <button type="button" role="tab" aria-selected={tab === 'book'} className={tab === 'book' ? 'on' : ''} onClick={() => setTab('book')}>🎨 Shade book</button>
      </div>

      {tab === 'photo' && (
        <>
          <p className="easy-help">Tap on the saree where the colour is. You can tap again to change.</p>
          {photos.length > 1 && (
            <div className="cpick-photos">
              {photos.map((p, i) => (
                <button key={p.id || p.url} type="button" className={i === photoIdx ? 'on' : ''} onClick={() => setPhotoIdx(i)} aria-label={`Use photo ${i + 1}`}>
                  <img src={p.url} alt="" />
                </button>
              ))}
            </div>
          )}
          <div className="cpick-canvas">
            <canvas ref={canvasRef} onClick={sample} aria-label="Tap on the photo to pick a colour" />
            {picked && <span className="cpick-ring" style={{ left: `${picked.x}%`, top: `${picked.y}%`, background: picked.hex }} />}
          </div>
          {picked && (
            <div className="cpick-result">
              <span className="dot big" style={{ background: picked.hex }} />
              <div className="grow">
                <p className="small muted">Name this colour (tap one or type):</p>
                <div className="easy-chips">
                  {nearestShades(picked.hex, 4).map(([n, h]) => (
                    <button key={n} type="button" className={`easy-chip sm ${name === n ? 'on' : ''}`} onClick={() => setName(n)}>
                      <span className="dot xs" style={{ background: h }} /> {n}
                    </button>
                  ))}
                </div>
                <input className="easy-input sm" value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} aria-label="Colour name" />
              </div>
            </div>
          )}
          <button type="button" className="btn btn-primary easy-btn wide" disabled={!picked || name.trim().length < 2} onClick={() => onPick({ name: name.trim(), hex: picked.hex })}>✓ Use this colour</button>
        </>
      )}

      {tab === 'book' && (
        <div className="cpick-book">
          {SHADE_FAMILIES.map((f) => (
            <div key={f.family}>
              <h3 className="cpick-family">{f.family}</h3>
              <div className="easy-colours">
                {f.shades.map(([n, h]) => (
                  <button key={n} type="button" className="easy-colour" onClick={() => onPick({ name: n, hex: h })}>
                    <span className="dot" style={{ background: h }} />{n}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <h3 className="cpick-family">Others</h3>
          <div className="easy-colours">
            <button type="button" className="easy-colour" onClick={() => onPick({ name: MULTI[0], hex: MULTI[1] })}>
              <span className="dot" style={{ background: swatchBg('linear') }} />Multicolour
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
