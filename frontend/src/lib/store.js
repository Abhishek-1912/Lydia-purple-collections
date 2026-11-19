import { useEffect, useState } from 'react'
import { api } from './api.js'
import { rupees, whatsappLink } from './config.js'

import { useSettings } from '../context/SettingsContext.jsx'

export const useStoreRules = useSettings

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
