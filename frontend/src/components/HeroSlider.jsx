import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext.jsx'

// Home top slider: slide 1 = the designed purple hero (children), then banner photos from Admin → Settings.
// Banners are shown whole and sharp at their real shape (never cropped), with ‹ › / swipe / dots.
// Auto-slides every N seconds (Admin → Settings → Seconds per slide, default 2).
export default function HeroSlider({ children }) {
  const { banners = [], slide_seconds: secs = 2 } = useSettings()
  const total = 1 + banners.length
  const [i, setI] = useState(0)
  const [pausedUntil, setPausedUntil] = useState(0)
  const touch = useRef(null)
  const go = (to) => { setI(((to % total) + total) % total); setPausedUntil(Date.now() + 10000) }

  useEffect(() => { if (i >= total) setI(0) }, [total, i])
  useEffect(() => {
    if (total < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => { if (!document.hidden && Date.now() >= pausedUntil) setI((x) => (x + 1) % total) }, Math.max(2, secs) * 1000)
    return () => clearInterval(t)
  }, [total, pausedUntil, secs])

  if (total === 1) return children

  return (
    <div className="hero-slider" aria-roledescription="carousel" aria-label="Highlights"
      onMouseEnter={() => setPausedUntil(Date.now() + 60000)} onMouseLeave={() => setPausedUntil(0)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (touch.current == null) return
        const dx = e.changedTouches[0].clientX - touch.current
        touch.current = null
        if (Math.abs(dx) > 40) go(dx < 0 ? i + 1 : i - 1)
      }}>
      <div className="hero-slide" key={i} aria-roledescription="slide" aria-label={`${i + 1} of ${total}`}>
        {i === 0 ? children : (() => {
          const b = banners[i - 1]
          return (
            <Link to={b.link || '/shop'} className="banner-slide">
              <img src={b.url} alt={b.alt || 'Lydia Purple Collections'} width={b.w || 1920} height={b.h || 850}
                style={{ aspectRatio: b.w && b.h ? `${b.w} / ${b.h}` : '1920 / 850' }} decoding="async" />
            </Link>
          )
        })()}
      </div>
      {/* preload the next banner so slides change instantly */}
      {banners[i] && <link rel="preload" as="image" href={banners[i].url} />}
      <button type="button" className="gal-arrow prev" onClick={() => go(i - 1)} aria-label="Previous slide">‹</button>
      <button type="button" className="gal-arrow next" onClick={() => go(i + 1)} aria-label="Next slide">›</button>
      <div className="gal-dots">
        {Array.from({ length: total }, (_, k) => (
          <button key={k} type="button" aria-label={`Slide ${k + 1}`} aria-current={k === i} className={k === i ? 'on' : ''} onClick={() => go(k)} />
        ))}
      </div>
    </div>
  )
}
