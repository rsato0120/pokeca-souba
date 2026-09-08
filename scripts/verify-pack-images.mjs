import fs from 'node:fs'
import assert from 'node:assert/strict'
const catalog = JSON.parse(fs.readFileSync('data/pokeca_data.json', 'utf8'))
const bounds = JSON.parse(fs.readFileSync('data/pack-image-bounds.json', 'utf8'))
for (const box of catalog.boxes) {
  if (!box.pack_image_url) continue
  const b = bounds[box.pack_image_url]
  assert.ok(b, `${box.box_id}: run npm run prepare:pack-images before adding a new image`)
  assert.ok(Object.values(b).every(Number.isFinite), `${box.box_id}: invalid bounds`)
  assert.ok(b.left >= 0 && b.top >= 0 && b.contentWidth > 0 && b.contentHeight > 0)
  assert.ok(b.left + b.contentWidth <= b.width && b.top + b.contentHeight <= b.height)
}
console.log('All catalog pack images have valid content bounds')
