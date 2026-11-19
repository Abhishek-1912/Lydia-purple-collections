import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { api } from '../lib/api.js'

// Wishlist: guests keep it in this browser; signed-in customers keep it in their account (merged on sign-in).
const KEY = 'lpc_wish_v1'
const Ctx = createContext(null)
const readLocal = () => { try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] } }
const writeLocal = (ids) => { try { localStorage.setItem(KEY, JSON.stringify(ids)) } catch { /* private mode */ } }

export function WishlistProvider({ children }) {
  const { user, getToken } = useAuth()
  const [ids, setIds] = useState(readLocal)

  useEffect(() => {
    if (!user) return
    let alive = true
    ;(async () => {
      const token = await getToken()
      const local = readLocal()
      if (local.length) await api('/api/me/wishlist/merge', { method: 'POST', body: { product_ids: local }, token }).catch(() => {})
      const list = await api('/api/me/wishlist', { token }).catch(() => null)
      if (alive && list) { const server = list.map((p) => p.id); setIds(server); writeLocal(server) }
    })()
    return () => { alive = false }
  }, [user, getToken])

  const toggle = useCallback(async (productId) => {
    const on = ids.includes(productId)
    const next = on ? ids.filter((i) => i !== productId) : [productId, ...ids]
    setIds(next); writeLocal(next)
    if (user) {
      const token = await getToken()
      api(`/api/me/wishlist/${productId}`, { method: on ? 'DELETE' : 'PUT', token }).catch(() => {})
    }
    return !on
  }, [ids, user, getToken])

  return <Ctx.Provider value={{ ids, count: ids.length, has: (id) => ids.includes(id), toggle }}>{children}</Ctx.Provider>
}

export const useWishlist = () => useContext(Ctx) || { ids: [], count: 0, has: () => false, toggle: async () => false }
