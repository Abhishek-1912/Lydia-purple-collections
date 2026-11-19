// /robots.txt — points search engines at the sitemap on whatever domain the site is served from.
export default function handler(req, res) {
  const site = `https://${req.headers['x-forwarded-host'] || req.headers.host}`
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.status(200).send(`User-agent: *
Disallow: /admin
Disallow: /account
Disallow: /checkout
Disallow: /order/
Disallow: /login
Sitemap: ${site}/sitemap.xml
`)
}
