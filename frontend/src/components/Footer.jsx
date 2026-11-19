import { Link } from 'react-router-dom'
import { Lotus } from './Icons.jsx'
import { config, whatsappLink, SHOP_NAME } from '../lib/config.js'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="zari" />
      <div className="container footer-grid">
        <div>
          <div className="footer-logo"><Lotus size={28} /> {SHOP_NAME}</div>
          <p className="muted-light">Handpicked silk sarees and ethnic wear, quality checked and shipped across India.</p>
        </div>
        <div>
          <h2 className="footer-h">Shop</h2>
          <ul>
            <li><Link to="/collections/sarees">Sarees</Link></li>
            <li><Link to="/collections/ethnic-wear">Ethnic Wear</Link></li>
            <li><Link to="/bridal">Bridal Edit</Link></li>
            <li><Link to="/shop">All Products</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="footer-h">Help</h2>
          <ul>
            <li><Link to="/contact">Contact us</Link></li>
            <li><Link to="/policies#shipping">Shipping</Link></li>
            <li><Link to="/policies#returns">Returns & Exchange</Link></li>
            <li><Link to="/policies#cancellation">Cancellation &amp; refunds</Link></li>
            <li><Link to="/policies#privacy">Privacy</Link></li>
            <li><Link to="/terms">Terms &amp; Conditions</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="footer-h">Reach us</h2>
          <ul>
            <li><a href={whatsappLink('Hi! I have a question.')} target="_blank" rel="noreferrer">WhatsApp</a></li>
            {config.phone && <li><a href={`tel:${config.phone.replace(/\s/g, '')}`}>{config.phone}</a></li>}
            {config.email && <li><a href={`mailto:${config.email}`}>{config.email}</a></li>}
            {config.instagram && <li><a href={config.instagram} target="_blank" rel="noreferrer">Instagram</a></li>}
          </ul>
        </div>
      </div>
      <p className="container copyright">© {new Date().getFullYear()} {SHOP_NAME}{config.address && <> · {config.address}</>}. Prices include GST.</p>
    </footer>
  )
}
