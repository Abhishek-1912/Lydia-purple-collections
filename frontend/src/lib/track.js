import { api } from './api.js'
import { sessionId } from './session.js'

// Anonymous shop stats (product views → cart → checkout). No names, phones or emails.
// Skipped when the browser asks not to be tracked.
const seen = new Set()
export function track(type, productId = null) {
  try {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return
    const key = `${type}:${productId || ''}`
    if (type !== 'cart' && seen.has(key)) return  // one view per product per page load
    seen.add(key)
    const sid = sessionId()
    if (sid) api('/api/events', { method: 'POST', body: { session_id: sid, type, product_id: productId } }).catch(() => {})
  } catch { /* never break the page for stats */ }
}
