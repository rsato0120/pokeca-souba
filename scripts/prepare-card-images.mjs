import fs from 'node:fs'
import sharp from 'sharp'

const catalog = JSON.parse(fs.readFileSync('data/pokeca_data.json', 'utf8'))
const file = 'data/card-image-bounds.json'
const bounds = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
const sources = [...new Set(catalog.cards.filter(card => card.box_id.startsWith('30th_')).map(card => card.image_url).filter(Boolean))]
for (const src of sources) {
  if (bounds[src]) continue
  const response = await fetch(src, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`image HTTP ${response.status}: ${src}`)
  const input = Buffer.from(await response.arrayBuffer())
  const original = await sharp(input).metadata()
  const { info } = await sharp(input).trim({ threshold: 20 }).toBuffer({ resolveWithObject: true })
  bounds[src] = { width: original.width, height: original.height,
    left: Math.abs(info.trimOffsetLeft ?? 0), top: Math.abs(info.trimOffsetTop ?? 0),
    contentWidth: info.width, contentHeight: info.height }
  // LEGENDなど横向きのカードも、向きを変えずカード全体を表示する。
  if (info.width / info.height < 0.65 || info.width / info.height > 1.5) throw new Error(`Unexpected card aspect ratio: ${src}`)
}
fs.writeFileSync(file, JSON.stringify(bounds, null, 2) + '\n')
console.log(`Prepared ${sources.length} card image bounds`)
