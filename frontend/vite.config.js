import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Social apps need full image URLs in share tags. On Vercel, VERCEL_PROJECT_PRODUCTION_URL is the
// production domain (your custom domain once added), so the home-page preview always points at it.
const site = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : ''
const absoluteShareImage = {
  name: 'absolute-share-image',
  transformIndexHtml: (html) => html.replace('content="/og-default.jpg"', `content="${site}/og-default.jpg"`),
}

export default defineConfig({ plugins: [react(), absoluteShareImage], server: { port: 5173 } })
