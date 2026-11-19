// Shop filters: facets are built from the products on the page, so options always match real stock.
import { SHADE_FAMILIES, nearestShades } from './shades.js'

export const PRICE_BUCKETS = [
  { id: 'u2', label: 'Under ₹2,000', min: 0, max: 1999 },
  { id: '2-5', label: '₹2,000 – ₹5,000', min: 2000, max: 5000 },
  { id: '5-10', label: '₹5,000 – ₹10,000', min: 5001, max: 10000 },
  { id: '10-20', label: '₹10,000 – ₹20,000', min: 10001, max: 20000 },
  { id: '20p', label: 'Above ₹20,000', min: 20001, max: Infinity },
]
export const DISCOUNTS = [10, 20, 30, 50]

const FAMILY_LABEL = { 'Reds': 'Red', 'Pinks': 'Pink', 'Yellows & Oranges': 'Yellow & Orange', 'Greens': 'Green', 'Blues': 'Blue', 'Purples': 'Purple', 'Whites, Greys & Browns': 'White, Grey & Brown' }
const FAMILY_HEX = { 'Red': '#B0121B', 'Pink': '#C2185B', 'Yellow & Orange': '#E5A500', 'Green': '#3E8E2E', 'Blue': '#1F4FBF', 'Purple': '#5E1A73', 'White, Grey & Brown': '#D8C3A0', 'Multicolour': 'linear' }
const familyCache = {}
export function colourFamily(hex) {
  if (!hex || hex === 'linear') return 'Multicolour'
  if (familyCache[hex]) return familyCache[hex]
  const [name] = nearestShades(hex, 1)[0]
  const fam = SHADE_FAMILIES.find((f) => f.shades.some(([n]) => n === name))
  return (familyCache[hex] = FAMILY_LABEL[fam?.family] || 'Multicolour')
}
export const familyHex = (f) => FAMILY_HEX[f]

const split = (s) => (s || '').split(/,\s*/).map((x) => x.trim()).filter(Boolean)
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
export const productFabric = (p) => (p.fabric || '').trim()
export const productOccasions = (p) => split(p.details?.occasion).map(cap)
export const productColours = (p) => [...new Set(p.colors.map((c) => colourFamily(c.hex)))]

/** Parse filter state from URL params. Lists are comma separated. */
export function readFilters(params) {
  const list = (k) => split(params.get(k))
  return { avail: list('avail'), price: list('price'), disc: Number(params.get('disc')) || 0, type: list('type'), fabric: list('fabric'), colour: list('colour'), occ: list('occ') }
}
export const activeCount = (f) => f.avail.length + f.price.length + (f.disc ? 1 : 0) + f.type.length + f.fabric.length + f.colour.length + f.occ.length

/** Does product p pass filters f, optionally ignoring one facet (used for counts)? */
export function passes(p, f, ignore) {
  const any = (want, have) => !want.length || want.some((w) => have.includes(w))
  if (ignore !== 'avail' && f.avail.length && !f.avail.includes(p.in_stock ? 'in' : 'out')) return false
  if (ignore !== 'price' && f.price.length && !f.price.some((id) => { const b = PRICE_BUCKETS.find((x) => x.id === id); return b && p.price >= b.min && p.price <= b.max })) return false
  if (ignore !== 'disc' && f.disc && p.discount_pct < f.disc) return false
  if (ignore !== 'type' && !any(f.type, [p.category?.slug])) return false
  if (ignore !== 'fabric' && !any(f.fabric, [productFabric(p)])) return false
  if (ignore !== 'colour' && !any(f.colour, productColours(p))) return false
  if (ignore !== 'occ' && !any(f.occ, productOccasions(p))) return false
  return true
}

/** Options + counts for each facet, given all products on the page and current filters. */
export function facets(products, f, cats = []) {
  const count = (facet, test) => products.filter((p) => passes(p, f, facet) && test(p)).length
  const values = (fn) => [...new Set(products.flatMap(fn))].filter(Boolean).sort()
  const catName = (slug) => cats.find((c) => c.slug === slug)?.name || slug
  return {
    avail: [['in', 'In stock'], ['out', 'Sold out']].map(([id, label]) => ({ id, label, n: count('avail', (p) => (p.in_stock ? 'in' : 'out') === id) })),
    price: PRICE_BUCKETS.map((b) => ({ id: b.id, label: b.label, n: count('price', (p) => p.price >= b.min && p.price <= b.max) })).filter((o) => o.n || f.price.includes(o.id)),
    disc: DISCOUNTS.map((d) => ({ id: String(d), label: `${d}% off or more`, n: count('disc', (p) => p.discount_pct >= d) })).filter((o) => o.n || f.disc === Number(o.id)),
    type: values((p) => [p.category?.slug]).map((s) => ({ id: s, label: catName(s), n: count('type', (p) => p.category?.slug === s) })),
    fabric: values((p) => [productFabric(p)]).map((v) => ({ id: v, label: v, n: count('fabric', (p) => productFabric(p) === v) })),
    colour: values(productColours).map((v) => ({ id: v, label: v, hex: familyHex(v), n: count('colour', (p) => productColours(p).includes(v)) })),
    occ: values(productOccasions).map((v) => ({ id: v, label: v, n: count('occ', (p) => productOccasions(p).includes(v)) })),
  }
}
