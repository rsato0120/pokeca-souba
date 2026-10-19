import fs from 'node:fs'
import assert from 'node:assert/strict'

const { cards } = JSON.parse(fs.readFileSync('data/pokeca_data.json', 'utf8'))
const bounds = JSON.parse(fs.readFileSync('data/card-image-bounds.json', 'utf8'))
for (const card of cards) {
  if (!card.image_url) continue
  const b = bounds[card.image_url]
  assert.ok(b, `${card.id}: run npm run prepare:card-images`)
  assert.ok(Object.values(b).every(Number.isFinite), `${card.id}: invalid bounds`)
  assert.ok(b.width > 0 && b.height > 0 && b.left >= 0 && b.top >= 0)
  assert.ok(b.contentWidth > 0 && b.contentHeight > 0)
  assert.ok(b.left + b.contentWidth <= b.width && b.top + b.contentHeight <= b.height)
  const ratio = b.contentWidth / b.contentHeight
  assert.ok((ratio >= 0.65 && ratio <= 0.8) || (ratio >= 1.25 && ratio <= 1.55), `${card.id}: unexpected card shape`)
}
console.log(`Verified image bounds for ${cards.length} cards`)
