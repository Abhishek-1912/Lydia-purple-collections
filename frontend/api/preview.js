// Link previews for WhatsApp, Facebook, Instagram, Telegram, X, LinkedIn.
// Those apps don't run JavaScript, so vercel.json sends their crawlers here for /products/<slug>
// and we return plain HTML with Open Graph tags (photo, name, price). Shoppers never see this page.
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN')

export default async function handler(req, res) {
  const slug = String(req.query.slug || '').replace(/[^a-z0-9-]/gi, '')
  const site = `https://${req.headers['x-forwarded-host'] || req.headers.host}`
  const api = (process.env.VITE_API_URL || '').replace(/\/$/, '')
  let p = null
  if (slug) try {
    const r = await fetch(`${api}/api/products/${slug}`, { signal: AbortSignal.timeout(4000) })
    if (r.ok) p = await r.json()
  } catch { /* fall back to generic preview */ }

  const url = slug ? `${site}/products/${slug}` : `${site}/`
  const title = p ? `${p.name} — ${inr(p.price)}` : 'Lydia Purple Collections'
  const desc = p
    ? [p.discount_pct ? `${p.discount_pct}% off (MRP ${inr(p.mrp)})` : '', p.details?.composition || p.fabric, p.in_stock ? 'In stock · UPI & Cash on Delivery' : 'Sold out — ask us on WhatsApp']
        .filter(Boolean).join(' · ')
    : 'Silk sarees and ethnic wear. UPI & Cash on Delivery across India.'
  const img = p?.images?.[0]?.url || `${site}/og-default.png`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400')
  res.status(p || !slug ? 200 : 404).send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Lydia Purple Collections">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:alt" content="${esc(p?.name || 'Lydia Purple Collections')}">
${p ? `<meta property="product:price:amount" content="${p.price}"><meta property="product:price:currency" content="INR">` : ''}
<meta name="twitter:card" content="summary_large_image">
</head><body><h1>${esc(title)}</h1><p>${esc(desc)}</p><a href="${esc(url)}">View product</a></body></html>`)
}
