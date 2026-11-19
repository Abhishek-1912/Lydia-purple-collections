import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const KEY = 'lpc_cart_v1'
const CartContext = createContext(null)

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

// Each line: { variant_id, qty, name, slug, color, size, price, image }  (display snapshot; server re-prices)
export function CartProvider({ children }) {
  const [items, setItems] = useState(load)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* private mode */ }
  }, [items])

  const api = useMemo(() => ({
    items,
    count: items.reduce((n, i) => n + i.qty, 0),
    add(line, qty = 1) {
      setItems((prev) => {
        const found = prev.find((i) => i.variant_id === line.variant_id)
        if (found) return prev.map((i) => i.variant_id === line.variant_id ? { ...i, qty: Math.min(10, i.qty + qty) } : i)
        return [...prev, { ...line, qty: Math.min(10, qty) }]
      })
    },
    setQty(variant_id, qty) {
      setItems((prev) => prev.map((i) => i.variant_id === variant_id ? { ...i, qty: Math.max(1, Math.min(10, qty)) } : i))
    },
    remove(variant_id) {
      setItems((prev) => prev.filter((i) => i.variant_id !== variant_id))
    },
    clear() { setItems([]) },
  }), [items])

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
