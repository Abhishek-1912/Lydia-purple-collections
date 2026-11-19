import { Link } from 'react-router-dom'

export const HERO_DEFAULTS = {
  bg: 'design', bg_url: '', bg_colour: '#5E1A73', dark: 35, mandala: true,
  eyebrow: 'Handpicked silks · Shipped across India',
  title: 'Draped in tradition,\nwoven for you',
  subtitle: 'Kanjivaram, Banarasi and soft silk sarees for every pooja, function and wedding.',
  btn1: 'Shop Sarees', btn1_link: '/collections/sarees',
  btn2: 'Bridal Edit', btn2_link: '/bridal',
}

/** The main (first) home slide. Everything on it can be changed in Admin → Settings → Main slide. */
export default function HeroMain({ hero = {}, preview = false }) {
  // Missing = original text; blank text = hidden (except the heading, which always shows something)
  const h = { ...HERO_DEFAULTS, ...Object.fromEntries(Object.entries(hero).filter(([, v]) => v != null)) }
  if (!h.title.trim()) h.title = HERO_DEFAULTS.title
  if (!['design', 'photo', 'colour'].includes(h.bg)) h.bg = 'design'
  const style = {}
  if (h.bg === 'photo' && h.bg_url) {
    const d = (h.dark ?? 35) / 100
    style.backgroundImage = `linear-gradient(90deg, rgba(20,6,28,${Math.min(0.9, d + 0.25)}) 0%, rgba(20,6,28,${d}) 55%, rgba(20,6,28,${d * 0.6}) 100%), url("${h.bg_url}")`
    style.backgroundSize = 'cover'
    style.backgroundPosition = 'center'
  } else if (h.bg === 'colour') {
    style.background = `radial-gradient(ellipse at 70% 30%, ${h.bg_colour} 0%, color-mix(in srgb, ${h.bg_colour} 55%, #000) 75%)`
  }
  const Btn = ({ to, className, children }) => preview ? <span className={className}>{children}</span> : <Link to={to} className={className}>{children}</Link>
  const lines = h.title.split('\n')
  const H = preview ? 'p' : 'h1'

  return (
    <section className={`hero ${preview ? 'hero-preview' : ''}`} style={style}>
      {h.mandala && <img className="hero-mandala" src="/mandala.webp" alt="" width="460" height="460" decoding="async" fetchpriority="low" />}
      <div className="container hero-inner">
        {h.eyebrow && <p className="eyebrow">{h.eyebrow}</p>}
        <H className="hero-title">{lines.map((l, i) => <span key={i}>{l}{i < lines.length - 1 && <br />}</span>)}</H>
        {h.subtitle && <p className="display hero-sub">{h.subtitle}</p>}
        <div className="hero-ctas">
          {h.btn1 && <Btn to={h.btn1_link} className="btn btn-gold">{h.btn1}</Btn>}
          {h.btn2 && <Btn to={h.btn2_link} className="btn btn-ghost-light">{h.btn2}</Btn>}
        </div>
      </div>
    </section>
  )
}
