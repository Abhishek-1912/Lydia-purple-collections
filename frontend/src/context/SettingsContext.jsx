import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { applyShopSettings, config } from '../lib/config.js'

// Shop details + fees from Admin → Settings. Cached in the browser so repeat visits show them instantly.
const KEY = 'lpc_settings_v1'
const SettingsContext = createContext(null)
const DEFAULTS = { free_shipping_above: 1999, shipping_fee: 99, cod_fee: 49, cod_max_order: 15000, razorpay_enabled: false, payment_timeout_minutes: 30 }

function cached() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null } catch { return null }
}

let initial = cached()
if (initial) applyShopSettings(initial)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => ({ ...DEFAULTS, ...(initial || {}) }))
  const [version, setVersion] = useState(0)

  useEffect(() => {
    api('/api/store-rules').then((fresh) => {
      try { localStorage.setItem(KEY, JSON.stringify(fresh)) } catch { /* ignore */ }
      const before = JSON.stringify({ ...config })
      applyShopSettings(fresh)
      setSettings({ ...DEFAULTS, ...fresh })
      if (JSON.stringify({ ...config }) !== before) setVersion((v) => v + 1) // contact details changed → re-render links
    }).catch(() => {})
  }, [])

  return (
    <SettingsContext.Provider value={settings}>
      <div key={version} style={{ display: 'contents' }}>{children}</div>
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext) || DEFAULTS
