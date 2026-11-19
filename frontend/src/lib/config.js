const env = import.meta.env
// Old placeholder values (from .env.example) count as empty, so nothing fake is ever shown to customers.
const PLACEHOLDER = /example\.com|90000 ?00000|9000000000|000000|^Shop address|^https:\/\/instagram\.com\/?$/i
const real = (v) => (v && !PLACEHOLDER.test(v) ? v : '')

export const config = {
  apiUrl: (env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, ''),
  supabaseUrl: env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY || '',
  whatsapp: real(env.VITE_WHATSAPP_NUMBER),
  phone: real(env.VITE_SHOP_PHONE),
  email: real(env.VITE_SHOP_EMAIL),
  address: real(env.VITE_SHOP_ADDRESS),
  instagram: real(env.VITE_INSTAGRAM),
  hours: real(env.VITE_SHOP_HOURS),
  announcement: '',
}

/** Values from Admin → Settings override the build-time defaults above. */
export function applyShopSettings(s = {}) {
  const map = { whatsapp: 'whatsapp', phone: 'phone', email: 'email', address: 'address', hours: 'hours', instagram: 'instagram', announcement: 'announcement' }
  for (const [from, to] of Object.entries(map)) if (s[from]) config[to] = s[from]
}

export const SHOP_NAME = 'Lydia Purple Collections'

export function whatsappLink(message = '') {
  const q = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${config.whatsapp}${q}`
}

export const rupees = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')
