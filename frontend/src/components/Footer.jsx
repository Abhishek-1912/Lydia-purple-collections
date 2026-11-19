import { Link } from 'react-router-dom'
import { ClockIcon, FacebookIcon, InstagramIcon, MailIcon, PhoneIcon, PinIcon, WhatsAppIcon } from './Icons.jsx'
import { config, whatsappLink, SHOP_NAME } from '../lib/config.js'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Link to="/" className="footer-logo" aria-label={`${SHOP_NAME} home`}><img src="/logo-full.webp" alt={SHOP_NAME} width="240" height="139" loading="lazy" decoding="async" /></Link>
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
          <ul className="reach">
            {config.whatsapp && <li><a href={whatsappLink('Hi! I have a question.')} target="_blank" rel="noreferrer"><WhatsAppIcon size={18} /> WhatsApp us</a></li>}
            {config.phone && <li><a href={`tel:${config.phone.replace(/\s/g, '')}`}><PhoneIcon /> {config.phone}</a></li>}
            {config.email && <li><a href={`mailto:${config.email}`}><MailIcon /> {config.email}</a></li>}
            {config.address && <li><span><PinIcon /> {config.address}</span></li>}
            {config.hours && <li><span><ClockIcon /> {config.hours}</span></li>}
            {!(config.whatsapp || config.phone || config.email || config.address) && <li><Link to="/contact">Contact us</Link></li>}
          </ul>
          {(config.instagram || config.facebook) && (
            <div className="socials">
              {config.instagram && <a href={config.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><InstagramIcon /></a>}
              {config.facebook && <a href={config.facebook} target="_blank" rel="noreferrer" aria-label="Facebook"><FacebookIcon /></a>}
            </div>
          )}
        </div>
      </div>
      <p className="container copyright">© {new Date().getFullYear()} {SHOP_NAME}. Prices include GST.</p>
    </footer>
  )
}
