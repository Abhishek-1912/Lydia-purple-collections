import { useState, useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Lotus, BagIcon, UserIcon, MenuIcon } from './Icons.jsx'
import { SHOP_NAME } from '../lib/config.js'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { rupees } from '../lib/config.js'
import { api } from '../lib/api.js'

// Menu: Home, All, then live categories from Admin → Categories (hidden ones never show), then collections.
const FALLBACK_CATS = [{ slug: 'sarees', name: 'Sarees' }, { slug: 'ethnic-wear', name: 'Ethnic Wear' }]
let catsPromise
const loadCats = () => (catsPromise ||= api('/api/categories').catch(() => { catsPromise = null; return FALLBACK_CATS }))
const navItems = (cats) => [
  { to: '/', label: 'Home', end: true },
  { to: '/shop', label: 'All' },
  ...cats.map((c) => ({ to: `/collections/${c.slug}`, label: c.name })),
  { to: '/bridal', label: 'Bridal' },
  { to: '/new-arrivals', label: 'New Arrivals' },
  { to: '/clearance', label: 'Clearance' },
  { to: '/contact', label: 'Contact' },
]

export default function Header() {
  const [open, setOpen] = useState(false)
  const [cats, setCats] = useState(FALLBACK_CATS)
  useEffect(() => { loadCats().then((c) => c?.length && setCats(c)) }, [])
  const { pathname } = useLocation()
  useEffect(() => { setOpen(false) }, [pathname])
  const { count: cartCount } = useCart()
  const { user, isAdmin } = useAuth()
  const st = useSettings()
  const announce = st.announcement || `Free shipping above ${rupees(st.free_shipping_above)} · UPI & COD · WhatsApp orders`

  return (
    <header className="site-header">
      <div className="announce">{announce}</div>
      <div className="header-bar container">
        <button className="icon-btn menu-btn" aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen(!open)}>
          <MenuIcon open={open} />
        </button>
        <Link to="/" className="logo">
          <Lotus size={34} />
          <span className="logo-text">
            <span className="logo-main">Lydia Purple</span>{' '}
            <span className="logo-sub">Collections</span>
          </span>
        </Link>
        <div className="header-actions">
          {isAdmin && <Link to="/admin" className="admin-pill">Admin</Link>}
          <Link to={user ? '/account' : '/login'} className="icon-btn" aria-label={user ? 'My account' : 'Sign in'}><UserIcon /></Link>
          <Link to="/cart" className="icon-btn cart-btn" aria-label={`Cart, ${cartCount} items`}>
            <BagIcon />
            {cartCount > 0 && <span className="badge">{cartCount}</span>}
          </Link>
        </div>
      </div>
      <nav id="main-nav" className={`main-nav ${open ? 'open' : ''}`} aria-label="Main">
        <ul className="nav-list">
          {navItems(cats).map((n) => (
            <li key={n.to}><NavLink to={n.to} end={n.end}>{n.label}</NavLink></li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
