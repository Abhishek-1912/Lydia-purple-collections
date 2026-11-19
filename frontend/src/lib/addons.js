// Saree add-ons — mirrors backend/app/addons.py. Prices come from store rules; 0 = not offered.
export const SHAPEWEAR_SIZES = ['S', 'M', 'L', 'XL', 'XXL']
export const ADDON_CATEGORY = 'sarees'
export const NO_ADDONS = { fall: false, blouse: null, shapewear: null }

export function addonKey(a) {
  if (!a) return ''
  return `${a.fall ? 'f' : ''}${a.blouse || ''}${a.shapewear ? `|${a.shapewear}` : ''}`
}
export const lineKey = (variantId, a) => `${variantId}:${addonKey(a)}`

export function addonPrices(rules) {
  return { fall: rules.addon_fall || 0, regular: rules.addon_blouse_regular || 0, designer: rules.addon_blouse_designer || 0, shapewear: rules.addon_shapewear || 0 }
}
export function addonTotal(a, prices) {
  if (!a) return 0
  return (a.fall ? prices.fall : 0) + (a.blouse ? prices[a.blouse] : 0) + (a.shapewear ? prices.shapewear : 0)
}
export function addonLabels(a) {
  if (!a) return []
  return [a.fall && 'Fall & edging', a.blouse && `Blouse stitching (${a.blouse === 'designer' ? 'Designer' : 'Regular'})`, a.shapewear && `Shapewear (${a.shapewear})`].filter(Boolean)
}
// Only send add-ons the customer actually chose
export const addonPayload = (a) => (addonKey(a) ? { fall: !!a.fall, blouse: a.blouse || null, shapewear: a.shapewear || null } : undefined)

export const MEASURE_FIELDS = [
  ['bust', 'Bust', true], ['waist', 'Waist', true], ['shoulder', 'Shoulder', true], ['blouse_length', 'Blouse length', true],
  ['sleeve_length', 'Sleeve length', false], ['armhole', 'Armhole', false], ['front_neck', 'Front neck depth', false], ['back_neck', 'Back neck depth', false],
]
