// Anonymous id for this browser (no personal data) — links an unfinished checkout to its order.
const KEY = 'lpc_sid'
export function sessionId() {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) { id = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^A-Za-z0-9_-]/g, ''); localStorage.setItem(KEY, id) }
    return id
  } catch { return null }
}
