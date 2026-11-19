import { useState, useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Lotus, BagIcon, UserIcon, MenuIcon } from './Icons.jsx'
import { SHOP_NAME } from '../lib/config.js'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const NAV = [
  { to: '/collections/sarees', label: 'Sarees' },
  { to: '/collections/ethnic-wear', label: 'Ethnic Wear' },
  { to: '/bridal', label: 'Bridal' },
  { to: '/new-arrivals', label: 'New Arrivals' },
  { to: '/clearance', label: 'Clearance' },
  { to: '/shop', label: 'All' },
  { to: '/contact', label: 'Contact' },
]

export default function Header() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => { setOpen(false) }, [pathname])
  const { count: cartCount } = useCart()
  const { user, isAdmin } = useAuth()

  return (
    <header className="site-header">
      <div className="announce">Free shipping above ₹1,999 · UPI & Cash on Delivery · Order on WhatsApp</div>
      <div className="header-bar container">
        <button className="icon-btn menu-btn" aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen(!open)}>
          <MenuIcon open={open} />
        </button>
        <Link to="/" className="logo" aria-label={`${SHOP_NAME} home`}>
          <Lotus size={34} />
          <span className="logo-text">
            <span className="logo-main">Lydia Purple</span>
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
        <ul className="container">
          {NAV.map((n) => (
            <li key={n.to}><NavLink to={n.to}>{n.label}</NavLink></li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
