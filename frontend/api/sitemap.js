// /sitemap.xml — every live product and collection, built from the API.
export default async function handler(req, res) {
  const site = `https://${req.headers['x-forwarded-host'] || req.headers.host}`
  const api = (process.env.VITE_API_URL || '').replace(/\/$/, '')
  const pages = ['/', '/shop', '/bridal', '/new-arrivals', '/clearance', '/contact', '/policies', '/terms']
  try {
    const [cats, products] = await Promise.all([
      fetch(`${api}/api/categories`).then((r) => r.json()),
      fetch(`${api}/api/products`).then((r) => r.json()),
    ])
    cats.forEach((c) => pages.push(`/collections/${c.slug}`))
    products.forEach((p) => pages.push(`/products/${p.slug}`))
  } catch { /* static pages only */ }
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${site}${p}</loc></url>`).join('\n')}
</urlset>`)
}
