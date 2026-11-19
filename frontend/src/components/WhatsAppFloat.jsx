import { WhatsAppIcon } from './Icons.jsx'
import { config, whatsappLink } from '../lib/config.js'

export default function WhatsAppFloat() {
  if (!config.whatsapp) return null // set the number in Admin → Settings
  return (
    <a className="wa-float" href={whatsappLink('Hi! I would like to place an order.')}
      target="_blank" rel="noreferrer" aria-label="Order on WhatsApp">
      <WhatsAppIcon size={26} />
      <span className="wa-float-text">Order on WhatsApp</span>
    </a>
  )
}
