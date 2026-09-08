import fs from 'node:fs'
import sharp from 'sharp'

const catalog = JSON.parse(fs.readFileSync('data/pokeca_data.json', 'utf8'))
const file = 'data/pack-image-bounds.json'
const bounds = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
for (const box of catalog.boxes) {
  const src = box.pack_image_url
  if (!src || bounds[src]) continue
  const response = await fetch(src, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`${box.box_id}: image HTTP ${response.status}`)
  const input = Buffer.from(await response.arrayBuffer())
  const original = await sharp(input).metadata()
  const { info } = await sharp(input).trim({ threshold: 20 }).toBuffer({ resolveWithObject: true })
  bounds[src] = { width: original.width, height: original.height,
    left: Math.abs(info.trimOffsetLeft ?? 0), top: Math.abs(info.trimOffsetTop ?? 0),
    contentWidth: info.width, contentHeight: info.height }
  fs.writeFileSync(file, JSON.stringify(bounds, null, 2) + '\n')
  console.log(`${box.box_id}: ${original.width}x${original.height} -> ${info.width}x${info.height}`)
}
