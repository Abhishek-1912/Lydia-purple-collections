// Ready-made details so the owner only taps a type instead of typing.
export const KINDS = [
  { id: 'saree', label: 'Saree', emoji: '🥻', category: 'sarees', sized: false },
  { id: 'blouse', label: 'Blouse', emoji: '👚', category: 'blouses', sized: true },
  { id: 'kurti', label: 'Kurti / Dress', emoji: '👗', category: 'ethnic-wear', sized: true },
  { id: 'lehenga', label: 'Lehenga set', emoji: '✨', category: 'ethnic-wear', sized: true },
]

const SAREE_BASE = { saree_length: '5.5 m', saree_width: '1.15 m (45 in)', blouse_piece: 'Included · 0.8 m unstitched' }

export const SAREE_TYPES = [
  { id: 'kanjivaram', label: 'Kanjivaram', fabric: 'Pure Kanjivaram silk', composition: 'Pure mulberry silk, zari', weave: 'Handloom', origin: 'Kanchipuram, Tamil Nadu', occasion: 'Weddings, functions, poojas', care: 'Dry clean only', bridal: true },
  { id: 'banarasi', label: 'Banarasi', fabric: 'Banarasi silk', composition: 'Banarasi silk, zari', weave: 'Handloom Banarasi', origin: 'Varanasi, Uttar Pradesh', occasion: 'Weddings, festivals', care: 'Dry clean only', bridal: true },
  { id: 'softsilk', label: 'Soft silk', fabric: 'Soft silk', composition: 'Soft silk blend', weave: 'Powerloom', origin: 'Tamil Nadu', occasion: 'Poojas, office, family functions', care: 'Gentle hand wash in cold water' },
  { id: 'mysore', label: 'Mysore silk', fabric: 'Mysore silk', composition: 'Pure crepe silk', weave: 'Powerloom', origin: 'Mysuru, Karnataka', occasion: 'Parties, office, festivals', care: 'Dry clean recommended' },
  { id: 'pattu', label: 'Pochampally / Ikat', fabric: 'Pochampally ikat silk', composition: 'Silk, ikat weave', weave: 'Handloom ikat', origin: 'Pochampally, Telangana', occasion: 'Festivals, functions', care: 'Dry clean only' },
  { id: 'gadwal', label: 'Gadwal', fabric: 'Gadwal silk cotton', composition: 'Cotton body, silk border', weave: 'Handloom', origin: 'Gadwal, Telangana', occasion: 'Festivals, poojas', care: 'Dry clean recommended' },
  { id: 'uppada', label: 'Uppada', fabric: 'Uppada silk', composition: 'Silk, jamdani weave', weave: 'Handloom jamdani', origin: 'Uppada, Andhra Pradesh', occasion: 'Weddings, functions', care: 'Dry clean only' },
  { id: 'tussar', label: 'Tussar', fabric: 'Tussar silk', composition: 'Pure Tussar silk', weave: 'Handloom', origin: 'Bhagalpur, Bihar', occasion: 'Day events, festivals', care: 'Dry clean only' },
  { id: 'paithani', label: 'Paithani', fabric: 'Paithani silk', composition: 'Pure silk, zari', weave: 'Handloom Paithani', origin: 'Yeola, Maharashtra', occasion: 'Weddings, festivals', care: 'Dry clean only', bridal: true },
  { id: 'organza', label: 'Organza', fabric: 'Organza', composition: 'Organza', weave: 'Printed / embroidered', origin: 'Surat, Gujarat', occasion: 'Parties, day functions', care: 'Dry clean only' },
  { id: 'georgette', label: 'Georgette / Chiffon', fabric: 'Georgette', composition: 'Georgette', weave: 'Printed / embroidered', origin: 'Surat, Gujarat', occasion: 'Parties, daily wear', care: 'Gentle hand wash' },
  { id: 'cotton', label: 'Cotton', fabric: 'Cotton', composition: 'Pure cotton', weave: 'Handloom', origin: 'India', occasion: 'Daily wear, office', care: 'Hand wash separately in cold water' },
  { id: 'other', label: 'Other', fabric: '', composition: '', weave: '', origin: '', occasion: '', care: 'Dry clean recommended' },
].map((t) => ({ ...SAREE_BASE, ...t }))

export const OTHER_DETAILS = {
  blouse: { fabric: 'Silk blend', care: 'Dry clean only', occasion: 'Pairs with silk sarees' },
  kurti: { fabric: 'Cotton silk', care: 'Hand wash separately', occasion: 'Festivals, office, parties' },
  lehenga: { fabric: 'Art silk', care: 'Dry clean only', occasion: 'Sangeet, mehendi, receptions' },
}

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free size']

export const COLOURS = [
  ['Red', '#C1121F'], ['Maroon', '#6B1020'], ['Rani Pink', '#C2185B'], ['Baby Pink', '#F4B6C2'], ['Peach', '#F6B48F'],
  ['Orange', '#E8631C'], ['Mustard', '#D4A017'], ['Yellow', '#F2C200'], ['Gold', '#C9A227'], ['Cream', '#EFE3C2'],
  ['White', '#FFFFFF'], ['Silver Grey', '#A9A9A9'], ['Black', '#1A1A1A'], ['Purple', '#5E1A73'], ['Lavender', '#B79FD6'],
  ['Wine', '#5A1030'], ['Navy Blue', '#1A2A5E'], ['Royal Blue', '#1F4FBF'], ['Sky Blue', '#7EC8E3'], ['Peacock Blue', '#0F6E7A'],
  ['Teal', '#127C7C'], ['Bottle Green', '#1F5E3B'], ['Parrot Green', '#5DBB2F'], ['Mint', '#9ED9C3'], ['Brown', '#6B3E26'],
  ['Beige', '#D8C3A0'], ['Multicolour', 'linear'],
]
