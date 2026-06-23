import * as fs from 'fs'
import * as path from 'path'

const pricesDir = path.join(process.cwd(), 'data', 'prices')
const forecastsDir = path.join(process.cwd(), 'data', 'forecasts')

let updated = 0
let skipped = 0

for (const file of fs.readdirSync(forecastsDir)) {
  if (!file.endsWith('.json')) continue
  const cardId = file.replace('.json', '')
  const priceFile = path.join(pricesDir, `${cardId}.json`)

  if (!fs.existsSync(priceFile)) { skipped++; continue }

  const priceData = JSON.parse(fs.readFileSync(priceFile, 'utf-8'))
  if (!priceData.history?.length) { skipped++; continue }

  const rec = priceData.history[0]
  const avg: number = rec.avg ?? rec.low
  const newLow  = rec.low < rec.high ? rec.low  : Math.round(avg * 0.90)
  const newHigh = rec.low < rec.high ? rec.high : Math.round(avg * 1.10)

  const forecastPath = path.join(forecastsDir, file)
  const forecast = JSON.parse(fs.readFileSync(forecastPath, 'utf-8'))
  const oldLow  = forecast.price_forecast.current_low
  const oldHigh = forecast.price_forecast.current_high

  if (oldLow !== newLow || oldHigh !== newHigh) {
    forecast.price_forecast.current_low  = newLow
    forecast.price_forecast.current_high = newHigh
    fs.writeFileSync(forecastPath, JSON.stringify(forecast, null, 2), 'utf-8')
    console.log(`${cardId}: ¥${oldLow}~¥${oldHigh} -> ¥${newLow}~¥${newHigh}`)
    updated++
  }
}

console.log(`\n更新: ${updated}件, スキップ: ${skipped}件`)
