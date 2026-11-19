// Shrinks phone photos in the browser before upload: max 1600 px, JPEG ~85%.
// A 6 MB camera photo becomes ~300 KB — faster upload, faster shop, never hits the 5 MB limit.
export async function compressImage(file, maxSide = 1600, quality = 0.85) {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not a photo.`)
  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Some browsers can't read certain formats (e.g. HEIC on desktop) — upload as-is if small enough
    if (file.size <= 5 * 1024 * 1024 && /jpe?g|png|webp/i.test(file.type)) return file
    throw new Error(`${file.name}: this photo format isn’t supported. Please use JPG or PNG.`)
  }
  const longest = Math.max(bitmap.width, bitmap.height)
  const scale = Math.min(1, maxSide / longest)
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
  if (!blob) return file
  const out = new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  out.tooSmall = longest < 600 // looks blurry on the shop — probably a WhatsApp preview or screenshot
  return out
}
