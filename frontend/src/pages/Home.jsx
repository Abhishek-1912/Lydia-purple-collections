import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { WhatsAppIcon } from '../components/Icons.jsx'
import { OccasionIcons, TempleBorder, TrustIcons } from '../components/Motifs.jsx'
import HeroSlider from '../components/HeroSlider.jsx'
import HeroMain from '../components/HeroMain.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { api } from '../lib/api.js'
import { ProductGrid } from '../components/ProductCard.jsx'
import { whatsappLink } from '../lib/config.js'

const TRUST = [
  { icon: 'upi', t: 'UPI & cards', d: 'GPay, PhonePe, Paytm' },
  { icon: 'cod', t: 'Cash on delivery', d: 'Pay when it arrives' },
  { icon: 'whatsapp', t: 'Order on WhatsApp', d: 'Chat, see a live video' },
  { icon: 'quality', t: 'Checked by hand', d: 'Every piece, before it ships' },
]

const OCCASIONS = [
  ['Wedding', 'Wedding'], ['Pooja', 'Pooja'], ['Festivals', 'Festival'], ['Party', 'Party'], ['Office', 'Office'], ['Daily wear', 'Daily wear'],
]

const FALLBACK_CATS = [
  { slug: 'sarees', name: 'Sarees', description: 'Kanjivaram, Banarasi, soft silk and more' },
  { slug: 'ethnic-wear', name: 'Ethnic Wear', description: 'Kurtis, lehengas and festive sets' },
]

export default function Home() {
  const settings = useSettings()
  const [cats, setCats] = useState(FALLBACK_CATS)
  const [fresh, setFresh] = useState(null)
  const [bridal, setBridal] = useState(null)
  const [covers, setCovers] = useState({})
  useEffect(() => {
    api('/api/products?new=true&sort=newest&limit=4').then(setFresh).catch(() => setFresh([]))
    api('/api/products?bridal=true&limit=4').then(setBridal).catch(() => setBridal([]))
    document.title = 'Lydia Purple Collections — Silk Sarees & Ethnic Wear'
    api('/api/categories').then((c) => c?.length && setCats(c)).catch(() => {})
  }, [])

  // a real saree photo for each category tile (first in-stock product with a photo)
  useEffect(() => {
    cats.forEach((c) => {
      api(`/api/products?category=${encodeURIComponent(c.slug)}&in_stock=true&limit=6`)
        .then((ps) => {
          const url = ps.find((p) => p.images[0])?.images[0].url
          if (url) setCovers((x) => ({ ...x, [c.slug]: url }))
        }).catch(() => {})
    })
  }, [cats])
  const bridalCover = bridal?.find((p) => p.images[0])?.images[0].url

  return (
    <>
      <HeroSlider>
      <HeroMain hero={settings.hero} />
      </HeroSlider>

      <ul className="trust container" aria-label="Why shop with us">
        {TRUST.map((x) => (
          <li key={x.t}>
            <span className="trust-icon">{TrustIcons[x.icon]}</span>
            <span><strong>{x.t}</strong><small>{x.d}</small></span>
          </li>
        ))}
      </ul>

      <TempleBorder />

      <section className="container section">
        <h2 className="section-title">Shop by category</h2>
        <div className="cat-grid">
          {[...cats.map((c) => ({ key: c.slug, to: `/collections/${c.slug}`, name: c.name, desc: c.description, img: covers[c.slug] })),
            { key: 'bridal', to: '/bridal', name: 'Bridal', desc: 'For the muhurtham and every ritual around it', img: bridalCover }]
            .map((t, i) => (
              <Link key={t.key} to={t.to} className={`cat-tile ${i === 0 ? 'cat-feature' : ''} ${t.img ? '' : 'butta'}`}>
                {t.img && <img src={t.img} alt="" loading="lazy" decoding="async" />}
                <span className="cat-text">
                  <span className="cat-name">{t.name}</span>
                  {t.desc && <span className="cat-desc">{t.desc}</span>}
                  <span className="cat-go">Shop {t.name.toLowerCase()}</span>
                </span>
              </Link>
            ))}
        </div>
      </section>

      <section className="container section occasions" aria-labelledby="occ-h">
        <h2 id="occ-h" className="section-title">Shop by occasion</h2>
        <ul className="occ-row">
          {OCCASIONS.map(([key, label]) => (
            <li key={key}>
              <Link to={`/shop?occ=${encodeURIComponent(key)}`} className="occ">
                <span className="occ-ring">{OccasionIcons[key]}</span>
                <span className="occ-label">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <TempleBorder />

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
        <div className="help-panel butta">
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
