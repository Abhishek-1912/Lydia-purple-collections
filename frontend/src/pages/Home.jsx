import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { WhatsAppIcon } from '../components/Icons.jsx'
import { api } from '../lib/api.js'
import { ProductGrid } from '../components/ProductCard.jsx'
import { whatsappLink } from '../lib/config.js'

const TRUST = [
  { t: 'UPI & Cards', d: 'GPay, PhonePe, Paytm' },
  { t: 'Cash on Delivery', d: 'Pay when it arrives' },
  { t: 'WhatsApp Orders', d: 'Chat, see a live video' },
  { t: 'Quality Checked', d: 'Every piece, by hand' },
]

const FALLBACK_CATS = [
  { slug: 'sarees', name: 'Sarees', description: 'Kanjivaram, Banarasi, soft silk and more' },
  { slug: 'ethnic-wear', name: 'Ethnic Wear', description: 'Kurtis, lehengas and festive sets' },
]

export default function Home() {
  const [cats, setCats] = useState(FALLBACK_CATS)
  const [fresh, setFresh] = useState(null)
  const [bridal, setBridal] = useState(null)
  useEffect(() => {
    api('/api/products?new=true&sort=newest&limit=4').then(setFresh).catch(() => setFresh([]))
    api('/api/products?bridal=true&limit=4').then(setBridal).catch(() => setBridal([]))
    document.title = 'Lydia Purple Collections — Silk Sarees & Ethnic Wear'
    api('/api/categories').then((c) => c?.length && setCats(c)).catch(() => {})
  }, [])

  return (
    <>
      <section className="hero">
        <img className="hero-mandala" src="/mandala.webp" alt="" width="460" height="460" decoding="async" fetchpriority="low" />
        <div className="container hero-inner">
          <p className="eyebrow">Handpicked silks · Shipped across India</p>
          <h1>Draped in tradition,<br />woven for you</h1>
          <p className="display hero-sub">Kanjivaram, Banarasi and soft silk sarees for every pooja, function and wedding.</p>
          <div className="hero-ctas">
            <Link to="/collections/sarees" className="btn btn-gold">Shop Sarees</Link>
            <Link to="/bridal" className="btn btn-ghost-light">Bridal Edit</Link>
          </div>
        </div>
      </section>

      <ul className="trust container" aria-label="Why shop with us">
        {TRUST.map((x) => (
          <li key={x.t}><strong>{x.t}</strong><span>{x.d}</span></li>
        ))}
      </ul>

      <div className="zari" />

      <section className="container section">
        <h2 className="section-title">Shop by category</h2>
        <div className="cat-grid">
          {cats.map((c) => (
            <Link key={c.slug} to={`/collections/${c.slug}`} className="cat-tile">
              <span className="cat-name">{c.name}</span>
              <span className="cat-desc">{c.description}</span>
            </Link>
          ))}
          <Link to="/bridal" className="cat-tile cat-bridal">
            <span className="cat-name">Bridal</span>
            <span className="cat-desc">For the big day and every ritual around it</span>
          </Link>
        </div>
      </section>

      <div className="zari" />

      <section className="container section" aria-labelledby="new-h">
        <div className="section-head">
          <h2 id="new-h" className="section-title">New Arrivals</h2>
          <Link to="/new-arrivals" className="link-gold">View all</Link>
        </div>
        <ProductGrid products={fresh || []} loading={!fresh} />
      </section>

      <section className="container section" aria-labelledby="bridal-h">
        <div className="section-head">
          <h2 id="bridal-h" className="section-title">The Bridal Edit</h2>
          <Link to="/bridal" className="link-gold">View all</Link>
        </div>
        <ProductGrid products={bridal || []} loading={!bridal} />
      </section>

      <section className="container section">
        <div className="help-panel">
          <div>
            <h2>Need help choosing?</h2>
            <p className="display">Chat with us on WhatsApp — ask for a live video, the real colour in daylight, or a matching blouse.</p>
          </div>
          <a className="btn btn-wa" href={whatsappLink('Hi! Can you help me choose a saree?')} target="_blank" rel="noreferrer">
            <WhatsAppIcon /> Chat on WhatsApp
          </a>
        </div>
      </section>
    </>
  )
}
