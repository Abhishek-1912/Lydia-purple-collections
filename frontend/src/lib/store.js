import { useEffect, useState } from 'react'
import { api } from './api.js'
import { rupees, whatsappLink } from './config.js'

const DEFAULT_RULES = { free_shipping_above: 1999, shipping_fee: 99, cod_fee: 49, cod_max_order: 15000, razorpay_enabled: false }
let rulesPromise

export function useStoreRules() {
  const [rules, setRules] = useState(DEFAULT_RULES)
  useEffect(() => {
    rulesPromise ||= api('/api/store-rules').catch(() => { rulesPromise = null; return DEFAULT_RULES })
    rulesPromise.then(setRules)
  }, [])
  return rules
}

export function useTitle(title, description) {
  useEffect(() => {
    document.title = title ? `${title} | Lydia Purple Collections` : 'Lydia Purple Collections — Silk Sarees & Ethnic Wear'
    if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description)
  }, [title, description])
}

export function lineLabel(l) {
  return [l.color, l.size].filter(Boolean).join(' / ')
}

export function productWhatsApp(product, variant) {
  const opt = variant ? lineLabel(variant) : ''
  return whatsappLink(
    `Hi! I'd like to order:\n${product.name}${opt ? ` (${opt})` : ''}\nPrice: ${rupees(product.price)}\n${window.location.origin}/products/${product.slug}`
  )
}

export function cartWhatsApp(lines, subtotal) {
  const body = lines.map((l, i) => `${i + 1}. ${l.name}${lineLabel(l) ? ` (${lineLabel(l)})` : ''} × ${l.qty} = ${rupees(l.price * l.qty)}`).join('\n')
  return whatsappLink(`Hi! I'd like to order these:\n${body}\nSubtotal: ${rupees(subtotal)}`)
}
