import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { lineKey } from '../lib/addons.js'

const KEY = 'lpc_cart_v1'
const CartContext = createContext(null)

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(v) ? v.map((i) => ({ ...i, key: i.key || lineKey(i.variant_id, i.addons) })) : []
  } catch {
    return []
  }
}

// Each line: { key, variant_id, addons?, qty, name, slug, color, size, price, image }  (display snapshot; server re-prices)
// The same saree with different add-ons is a separate line, so lines are addressed by `key`.
export function CartProvider({ children }) {
  const [items, setItems] = useState(load)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* private mode */ }
  }, [items])

  const api = useMemo(() => ({
    items,
    count: items.reduce((n, i) => n + i.qty, 0),
    add(line, qty = 1) {
      const key = lineKey(line.variant_id, line.addons)
      setItems((prev) => {
        const found = prev.find((i) => i.key === key)
        if (found) return prev.map((i) => i.key === key ? { ...i, qty: Math.min(10, i.qty + qty) } : i)
        return [...prev, { ...line, key, qty: Math.min(10, qty) }]
      })
    },
    setQty(key, qty) {
      setItems((prev) => prev.map((i) => i.key === key ? { ...i, qty: Math.max(1, Math.min(10, qty)) } : i))
    },
    remove(key) {
      setItems((prev) => prev.filter((i) => i.key !== key))
    },
    clear() { setItems([]) },
  }), [items])

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
