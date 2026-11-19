import { useCallback, useEffect, useRef, useState } from 'react'
import ProductImage from './ProductImage.jsx'

const AUTO_MS = 4000      // time per photo
const IDLE_MS = 8000      // after the shopper touches it, wait this long before sliding again
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Product photo slider: auto-slide, ‹ › buttons, swipe, dots, thumbnails, full-screen viewer.
export default function Gallery({ images, alt, hex }) {
  const [i, setI] = useState(0)
  const [full, setFull] = useState(false)
  const [pausedUntil, setPausedUntil] = useState(0)
  const touch = useRef(null)
  const n = images.length
  const go = useCallback((to, manual = true) => {
    setI(((to % n) + n) % n)
    if (manual) setPausedUntil(Date.now() + IDLE_MS)
  }, [n])

  useEffect(() => { setI(0) }, [images])

  // auto-slide (not in full screen, not when the shopper prefers less motion, not in background tabs)
  useEffect(() => {
    if (n < 2 || full || reduceMotion()) return
    const t = setInterval(() => {
      if (document.hidden || Date.now() < pausedUntil) return
      setI((x) => (x + 1) % n)
    }, AUTO_MS)
    return () => clearInterval(t)
  }, [n, full, pausedUntil])

  // keyboard in full screen
  useEffect(() => {
    if (!full) return
    const onKey = (e) => {
      if (e.key === 'Escape') setFull(false)
      if (e.key === 'ArrowRight') go(i + 1)
      if (e.key === 'ArrowLeft') go(i - 1)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [full, i, go])

  const swipe = {
    onTouchStart: (e) => { touch.current = e.touches[0].clientX; setPausedUntil(Date.now() + IDLE_MS) },
    onTouchEnd: (e) => {
      if (touch.current == null) return
      const dx = e.changedTouches[0].clientX - touch.current
      touch.current = null
      if (Math.abs(dx) > 40) go(dx < 0 ? i + 1 : i - 1)
    },
  }

  if (!n) {
    return <div className="gallery"><div className="gallery-main"><ProductImage alt={alt} hex={hex} eager /></div></div>
  }

  const controls = n > 1 && (
    <>
      <button type="button" className="gal-arrow prev" onClick={(e) => { e.stopPropagation(); go(i - 1) }} aria-label="Previous photo">‹</button>
      <button type="button" className="gal-arrow next" onClick={(e) => { e.stopPropagation(); go(i + 1) }} aria-label="Next photo">›</button>
      <div className="gal-dots" role="tablist" aria-label="Photos">
        {images.map((_, k) => (
          <button key={k} type="button" role="tab" aria-selected={k === i} aria-label={`Photo ${k + 1}`}
            className={k === i ? 'on' : ''} onClick={(e) => { e.stopPropagation(); go(k) }} />
        ))}
      </div>
    </>
  )

  return (
    <div className="gallery">
      <div className="gallery-main gal" {...swipe} onMouseEnter={() => setPausedUntil(Date.now() + 60_000)} onMouseLeave={() => setPausedUntil(0)}>
        <div className="gal-track" style={{ transform: `translateX(-${i * 100}%)` }}>
          {images.map((img, k) => (
            <button key={img.url} type="button" className="gal-slide" onClick={() => setFull(true)}
              aria-label={`Open photo ${k + 1} of ${n} full screen`} tabIndex={k === i ? 0 : -1}>
              <img src={img.url} alt={k === 0 ? alt : `${alt} — photo ${k + 1}`} loading={k === 0 ? 'eager' : 'lazy'} decoding="async" />
            </button>
          ))}
        </div>
        {controls}
        {n > 1 && <span className="gal-count" aria-live="polite">{i + 1} / {n}</span>}
        <span className="gal-zoom" aria-hidden="true">⤢ Tap to zoom</span>
      </div>

      {n > 1 && (
        <div className="thumbs">
          {images.map((g, k) => (
            <button key={g.url} type="button" className={`thumb ${k === i ? 'active' : ''}`} onClick={() => go(k)} aria-label={`Show photo ${k + 1}`}>
              <img src={g.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {full && (
        <div className="gal-full" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={() => setFull(false)} {...swipe}>
          <img src={images[i].url} alt={alt} onClick={(e) => e.stopPropagation()} />
          <button type="button" className="gal-close" onClick={() => setFull(false)} aria-label="Close" autoFocus>✕</button>
          {controls}
          {n > 1 && <span className="gal-count">{i + 1} / {n}</span>}
        </div>
      )}
    </div>
  )
}
