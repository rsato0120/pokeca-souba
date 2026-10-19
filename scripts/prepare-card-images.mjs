import fs from 'node:fs'
import sharp from 'sharp'

const catalog = JSON.parse(fs.readFileSync('data/pokeca_data.json', 'utf8'))
const file = 'data/card-image-bounds.json'
const bounds = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
const sources = [...new Set(catalog.cards.map(card => card.image_url).filter(Boolean))]
const cardRatio = (width, height) => {
  const ratio = width / height
  return (ratio >= 0.65 && ratio <= 0.8) || (ratio >= 1.25 && ratio <= 1.55)
}
let cursor = 0, prepared = 0
const failures = []
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < sources.length) {
    const src = sources[cursor++]
    if (bounds[src]) continue
    try {
      let input
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(src, { signal: AbortSignal.timeout(20000) })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          input = Buffer.from(await response.arrayBuffer())
          break
        } catch (error) { if (attempt === 2) throw error }
      }
      const original = await sharp(input).metadata()
      let crop = { width: original.width, height: original.height, left: 0, top: 0,
        contentWidth: original.width, contentHeight: original.height }
      // Even a landscape-shaped canvas can contain a padded portrait card.
      // Inspect its content first; retain printed borders when trimming is negligible.
      const { info } = await sharp(input).trim({ threshold: 20 }).toBuffer({ resolveWithObject: true })
      const padded = info.width * info.height < original.width * original.height * 0.92
      if (padded || !cardRatio(original.width, original.height)) {
        if (!cardRatio(info.width, info.height)) throw new Error(`Unexpected artwork ratio ${info.width}/${info.height}`)
        crop = { width: original.width, height: original.height,
          left: Math.abs(info.trimOffsetLeft ?? 0), top: Math.abs(info.trimOffsetTop ?? 0),
          contentWidth: info.width, contentHeight: info.height }
      }
      bounds[src] = crop
      prepared++
      fs.writeFileSync(file, JSON.stringify(bounds, null, 2) + '\n')
      if (prepared % 50 === 0) console.log(`Prepared ${prepared} additional card images`)
    } catch (error) { failures.push({ src, reason: error.message }); console.warn(`${src}: ${error.message}`) }
  }
}))
console.log(JSON.stringify({ catalogImages: sources.length, prepared, failed: failures.length }))
if (failures.length) {
  fs.mkdirSync('.tmp', { recursive: true })
  fs.writeFileSync('.tmp/card-image-failures.json', JSON.stringify(failures, null, 2))
  process.exitCode = 1
}
