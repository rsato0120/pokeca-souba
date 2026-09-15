import fs from 'node:fs'
import { getOnePieceCatalog, getOnePiecePrices, getOnePiecePredictionLog } from '../src/lib/onepiece'
import { generateOnePieceForecast } from '../src/lib/forecast'
import { onePieceMarketId } from '../src/lib/market-links'

async function main() {
  for (const dir of ['forecasts', 'predictions']) fs.mkdirSync(`data/onepiece/${dir}`, { recursive: true })
  const { products, sets } = getOnePieceCatalog()
  let failed = 0
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
  for (const product of products) {
    const prices = getOnePiecePrices(product.id)
    if (!prices || prices.history.length < 7 || Date.parse(today) - Date.parse(prices.history[0].date) > 7 * 86400000) continue
    const file = `data/onepiece/forecasts/${product.id}.json`
    if (fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')).generated_at?.slice(0, 10) === new Date().toISOString().slice(0, 10)) continue
    try {
      const forecast = await generateOnePieceForecast(product, sets.find(s => s.id === product.set_id)!, prices.history)
      fs.writeFileSync(file, JSON.stringify(forecast, null, 2) + '\n')
      const log = getOnePiecePredictionLog(product.id) ?? { card_id: onePieceMarketId(product.id), predictions: [] }
      // 同日の予想を何度生成しても、最初の予想を採点用に保持する。
      if (!log.predictions.some(p => p.date === today)) log.predictions.unshift({ date: today, mid: prices.history[0].avg!, up_pct: forecast.overall.up_pct, flat_pct: forecast.overall.flat_pct, down_pct: forecast.overall.down_pct })
      fs.writeFileSync(`data/onepiece/predictions/${product.id}.json`, JSON.stringify(log, null, 2) + '\n')
      console.log(`${product.id}: forecast saved`)
    } catch (error) { failed++; console.error(`${product.id}: ${String(error)}`) }
    await new Promise(r => setTimeout(r, 5000))
  }
  if (failed) process.exitCode = 1
}
main()
