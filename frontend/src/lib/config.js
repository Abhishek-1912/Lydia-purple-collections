const env = import.meta.env

export const config = {
  apiUrl: (env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, ''),
  supabaseUrl: env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY || '',
  whatsapp: env.VITE_WHATSAPP_NUMBER || '919000000000',
  phone: env.VITE_SHOP_PHONE || '',
  email: env.VITE_SHOP_EMAIL || '',
  address: env.VITE_SHOP_ADDRESS || '',
  instagram: env.VITE_INSTAGRAM || '',
  hours: env.VITE_SHOP_HOURS || 'Mon–Sat 10:00 am – 8:00 pm',
}

export const SHOP_NAME = 'Lydia Purple Collections'

export function whatsappLink(message = '') {
  const q = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${config.whatsapp}${q}`
}

export const rupees = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')
