import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { getForecast } from '../src/lib/data'

const original = process.cwd()
fs.mkdirSync('.tmp', { recursive: true })
const fixture = fs.mkdtempSync(path.join(original, '.tmp/current-price-'))
try {
  process.chdir(fixture)
  fs.mkdirSync('data/forecasts', { recursive: true })
  fs.mkdirSync('data/prices', { recursive: true })
  const forecast = { generated_at: '2026-09-06T00:00:00Z', price_forecast: {
    current_low: 100, current_high: 200, m1_low: 250, m1_high: 350,
  } }
  fs.writeFileSync('data/forecasts/test.json', JSON.stringify(forecast))
  assert.deepEqual(getForecast('test'), forecast, 'No observations: keep original forecast')
  fs.writeFileSync('data/prices/test.json', JSON.stringify({ history: [
    { date: '2026-09-08', low: 400, high: 600, avg: 500 },
    { date: '2026-09-06', low: 100, high: 200, avg: 150 },
  ] }))
  assert.deepEqual(getForecast('test'), { ...forecast, price_forecast: {
    ...forecast.price_forecast, current_low: 400, current_high: 600,
  } }, 'Price-only update must reach display without regenerating AI targets')
  assert.deepEqual(JSON.parse(fs.readFileSync('data/forecasts/test.json', 'utf8')), forecast,
    'Reading current prices must not rewrite the forecast or its generation date')
  fs.writeFileSync('data/prices/test.json', JSON.stringify({ history: [{ low: 600, high: 400 }] }))
  assert.deepEqual(getForecast('test'), forecast, 'Reject invalid observed range')
  console.log('Current price after price-only update: OK')
} finally {
  process.chdir(original)
  fs.rmSync(fixture, { recursive: true })
}
