// Traditional saree shade names, grouped by family. Used by the shade book and to name colours picked from photos.
export const SHADE_FAMILIES = [
  { family: 'Reds', shades: [['Kumkum Red', '#B0121B'], ['Chilli Red', '#D21F1F'], ['Cherry Red', '#9B1B30'], ['Tomato Red', '#E2432A'], ['Arakku Maroon', '#6B1020'], ['Wine', '#5A1030'], ['Rust', '#A0441C'], ['Brick Red', '#9C3B2A'], ['Coral', '#F2715A']] },
  { family: 'Pinks', shades: [['Rani Pink', '#C2185B'], ['Magenta', '#B0125B'], ['Fuchsia', '#D1328C'], ['Rose Pink', '#E8749A'], ['Onion Pink', '#D98A9A'], ['Baby Pink', '#F4B6C2'], ['Dusty Pink', '#C99A9E'], ['Peach', '#F6B48F'], ['Salmon', '#F08A72']] },
  { family: 'Yellows & Oranges', shades: [['Orange', '#E8631C'], ['Saffron', '#F28C28'], ['Mango Yellow', '#E5A500'], ['Haldi Yellow', '#F2B705'], ['Lemon Yellow', '#F4E04D'], ['Mustard', '#C99A12'], ['Honey', '#D49B3A'], ['Gold', '#C9A227'], ['Copper', '#B4643C']] },
  { family: 'Greens', shades: [['Parrot Green', '#5DBB2F'], ['Leaf Green', '#3E8E2E'], ['Mehendi Green', '#7A8B2E'], ['Elaichi Green', '#A3B86C'], ['Pista Green', '#B9D48A'], ['Mint', '#9ED9C3'], ['Rama Green', '#1E8C7E'], ['Sea Green', '#2E8B6A'], ['Emerald', '#0F7A4D'], ['Bottle Green', '#1F5E3B'], ['Olive', '#6B6B2A']] },
  { family: 'Blues', shades: [['Peacock Blue', '#0F6E7A'], ['Teal', '#127C7C'], ['Turquoise', '#2BB6B0'], ['Sky Blue', '#7EC8E3'], ['Powder Blue', '#B6D0E2'], ['Royal Blue', '#1F4FBF'], ['Denim', '#3B5B92'], ['Ink Blue', '#22306B'], ['Navy Blue', '#1A2A5E']] },
  { family: 'Purples', shades: [['Purple', '#5E1A73'], ['Violet', '#6A2C91'], ['Brinjal', '#4A1638'], ['Plum', '#5B2245'], ['Mauve', '#A27B94'], ['Lavender', '#B79FD6'], ['Lilac', '#C8A2C8']] },
  { family: 'Whites, Greys & Browns', shades: [['White', '#FFFFFF'], ['Off White', '#F5F0E6'], ['Cream', '#EFE3C2'], ['Sandal', '#E2C796'], ['Beige', '#D8C3A0'], ['Silver Grey', '#A9A9A9'], ['Steel Grey', '#5F6770'], ['Black', '#1A1A1A'], ['Brown', '#6B3E26'], ['Coffee', '#4B3021']] },
]
export const ALL_SHADES = SHADE_FAMILIES.flatMap((f) => f.shades)
export const MULTI = ['Multicolour', 'linear']

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
// Perceptual-ish distance (weighted RGB, "redmean")
function dist(a, b) {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b)
  const rm = (r1 + r2) / 2
  return Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2)
}
/** Closest traditional shade names for a picked colour, nearest first. */
export function nearestShades(hex, n = 4) {
  return [...ALL_SHADES].sort((x, y) => dist(hex, x[1]) - dist(hex, y[1])).slice(0, n)
}

export const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()

/** CSS background for a swatch: plain, two-tone (body + border) or multicolour. */
export function swatchBg(hex, hex2) {
  if (hex === 'linear' || !hex) return hex === 'linear' ? 'conic-gradient(red, orange, yellow, green, blue, purple, red)' : '#ccc'
  return hex2 ? `linear-gradient(135deg, ${hex} 0 58%, ${hex2} 58% 100%)` : hex
}
