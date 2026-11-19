import { useCallback, useEffect, useRef, useState } from 'react'
import ProductImage from './ProductImage.jsx'

const AUTO_MS = 4000      // time per photo
const IDLE_MS = 8000      // after the shopper touches it, wait this long before sliding again
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Product photo slider: auto-slide, ‹ › buttons, swipe, dots, thumbnails, full-screen viewer.
const ytId = (u = '') => (u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/) || [])[1]
const isFile = (u = '') => /\.(mp4|webm|mov)(\?|$)/i.test(u) || u.includes('/videos/')

function VideoSlide({ url, poster, active }) {
  const ref = useRef(null)
  const [play, setPlay] = useState(false)
  useEffect(() => { if (!active) { ref.current?.pause?.(); setPlay(false) } }, [active])
  const id = ytId(url)
  if (isFile(url)) {
    return <video ref={ref} className="gal-video" src={url} poster={poster} controls playsInline preload="none" aria-label="Product video" />
  }
  if (id) {
    return play
      ? <iframe className="gal-video" src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title="Product video" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      : <button type="button" className="gal-video gal-play" onClick={() => setPlay(true)} aria-label="Play video" style={{ backgroundImage: `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)` }}><span>▶</span></button>
  }
  return <a className="gal-video gal-play" href={url} target="_blank" rel="noreferrer" style={poster ? { backgroundImage: `url(${poster})` } : undefined}><span>▶</span><em>Watch video</em></a>
}

export default function Gallery({ images, alt, hex, video }) {
  const [i, setI] = useState(0)
  const [full, setFull] = useState(false)
  const [pausedUntil, setPausedUntil] = useState(0)
  const touch = useRef(null)
  const media = video ? [...images.slice(0, 1).map((m) => ({ ...m, kind: 'img' })), { kind: 'video', url: video }, ...images.slice(1).map((m) => ({ ...m, kind: 'img' }))] : images.map((m) => ({ ...m, kind: 'img' }))
  const n = media.length
  const go = useCallback((to, manual = true) => {
    setI(((to % n) + n) % n)
    if (manual) setPausedUntil(Date.now() + IDLE_MS)
  }, [n])

  useEffect(() => { setI(0) }, [images, video])

  // auto-slide (not in full screen, not when the shopper prefers less motion, not in background tabs)
  useEffect(() => {
    if (n < 2 || full || reduceMotion()) return
    const t = setInterval(() => {
      if (document.hidden || Date.now() < pausedUntil) return
      setI((x) => (media[x]?.kind === 'video' ? x : (x + 1) % n)) // never slide away from a video
    }, AUTO_MS)
    return () => clearInterval(t)
  }, [n, full, pausedUntil, media])

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

  if (!n || (!images.length && !video)) {
    return <div className="gallery"><div className="gallery-main"><ProductImage alt={alt} hex={hex} eager /></div></div>
  }

  const controls = n > 1 && (
    <>
      <button type="button" className="gal-arrow prev" onClick={(e) => { e.stopPropagation(); go(i - 1) }} aria-label="Previous photo">‹</button>
      <button type="button" className="gal-arrow next" onClick={(e) => { e.stopPropagation(); go(i + 1) }} aria-label="Next photo">›</button>
      <div className="gal-dots" role="tablist" aria-label="Photos">
        {media.map((_, k) => (
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
          {media.map((m, k) => m.kind === 'video' ? (
            <div key="video" className="gal-slide gal-slide-video"><VideoSlide url={m.url} poster={images[0]?.url} active={k === i} /></div>
          ) : (
            <button key={m.url} type="button" className="gal-slide" onClick={() => setFull(true)}
              aria-label={`Open photo ${k + 1} of ${n} full screen`} tabIndex={k === i ? 0 : -1}>
              <img src={m.url} alt={k === 0 ? alt : `${alt} — photo ${k + 1}`} loading={k === 0 ? 'eager' : 'lazy'} decoding="async" />
            </button>
          ))}
        </div>
        {controls}
        {n > 1 && <span className="gal-count" aria-live="polite">{i + 1} / {n}</span>}
        {media[i]?.kind === 'img' && <span className="gal-zoom" aria-hidden="true">⤢ Tap to zoom</span>}
      </div>

      {n > 1 && (
        <div className="thumbs">
          {media.map((g, k) => (
            <button key={g.url || 'video'} type="button" className={`thumb ${k === i ? 'active' : ''} ${g.kind === 'video' ? 'thumb-video' : ''}`} onClick={() => go(k)} aria-label={g.kind === 'video' ? 'Show video' : `Show photo ${k + 1}`}>
              {g.kind === 'video' ? <span>▶</span> : <img src={g.url} alt="" loading="lazy" />}
            </button>
          ))}
        </div>
      )}

      {full && (
        <div className="gal-full" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={() => setFull(false)} {...swipe}>
          {media[i]?.kind === 'img' && <img src={media[i].url} alt={alt} onClick={(e) => e.stopPropagation()} />}
          <button type="button" className="gal-close" onClick={() => setFull(false)} aria-label="Close" autoFocus>✕</button>
          {controls}
          {n > 1 && <span className="gal-count">{i + 1} / {n}</span>}
        </div>
      )}
    </div>
  )
}
