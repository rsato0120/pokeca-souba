import fs from 'node:fs'
import { existingSnkrdunkBoxes, hasNewBoxSales } from './snkrdunk-box-price-policy'
import { priceDisplayHistory } from '../src/lib/price-display'
import assert from 'node:assert/strict'
import { canUsePriceSource, canFetchMercariPrice, priceHistorySegments, currentPriceSeries, priceSeriesKey } from '../src/lib/price-source'
import { priceChangePct } from '../src/lib/price-change'
import { sparkSeries } from '../src/lib/market'
import { chainLink } from '../src/lib/index-series'
import type { PriceRecord, PriceSource } from '../src/types/pokeca'

const record = (date: string, avg: number, source?: PriceSource): PriceRecord => ({ date, avg, low: avg, high: avg, source })
for (const source of ['mercari', 'snkrdunk'] as const) {
  const other = source === 'mercari' ? 'snkrdunk' : 'mercari'
  assert.equal(canUsePriceSource(source, source), true)
  assert.equal(canUsePriceSource(source, other), false)
  assert.equal(canUsePriceSource(undefined, source), true)
  const history = [record('2026-09-17', 110, source), record('2026-09-16', 100, source), record('2026-09-15', 300, other), record('2026-09-14', 100, source)]
  const original = JSON.stringify(history)
  assert.equal(priceChangePct(history, 1, 35), 10)
  assert.equal(priceChangePct(history, 3, 35), null, 'A → B → A must not be treated as a continuous market')
  assert.deepEqual(currentPriceSeries(history), history.slice(0, 2))
  assert.deepEqual(sparkSeries(history), [100, 110])
  assert.equal(JSON.stringify(history), original, 'stored observations must remain intact')
  assert.notEqual(priceSeriesKey(history), priceSeriesKey(history.slice(2)))
  assert.equal(priceSeriesKey(history.slice(0, 2)), priceSeriesKey(history.slice(0, 1)), 'rolling same-market history must preserve visit comparisons')
}
assert.deepEqual(currentPriceSeries([]), [])
const oldSample = { ...record('2026-09-23', 126667, 'mercari'), oldest_sale_days: 59 }
const recentSample = { ...record('2026-10-07', 68200, 'mercari'), oldest_sale_days: 28 }
const refreshed = [recentSample, oldSample]
assert.deepEqual(currentPriceSeries(refreshed), [recentSample], 'Fresh trades must not create a cliff against an old broad sample')
assert.deepEqual(sparkSeries(refreshed), [68200])
assert.notEqual(priceSeriesKey(refreshed), priceSeriesKey([oldSample]), 'Visit comparisons must reset when the sampling basis changes')
const continuous = [{ ...recentSample, date: '2026-10-08', avg: 70000 }, recentSample, oldSample]
assert.equal(priceSeriesKey(continuous), priceSeriesKey(refreshed), 'New comparable observations must keep the visit baseline')
assert.deepEqual(currentPriceSeries(continuous), continuous.slice(0, 2))
assert.equal(currentPriceSeries([{ ...recentSample, oldest_sale_days: 30 }, oldSample]).length, 1)
assert.equal(currentPriceSeries([record('2026-09-17', 100), record('2026-09-16', 50)]).length, 1)
const markets = Array.from({ length: 15 }, () => new Map([
  ['2026-09-15', { value: 100, source: 'mercari' as const }],
  ['2026-09-16', { value: 120, source: 'snkrdunk' as const }],
  ['2026-09-17', { value: 132, source: 'snkrdunk' as const }],
]))
const index = chainLink(markets)
assert.equal(index[1].value, 100, '20% market-level difference must not move the index')
assert.equal(index[1].contributors, 0)
assert.ok(Math.abs(index[2].value - 110) < 1e-8, 'a genuine 10% same-market move must remain')
console.log('Price source stability, history preservation, sparkline and index regression checks: OK')

assert.equal(canFetchMercariPrice(123, 'snkrdunk'), false, 'No trades must not fall back to Mercari')
assert.equal(canFetchMercariPrice(123, 'mercari'), false, 'Existing Mercari history must not override product availability')
assert.equal(canFetchMercariPrice(null, 'snkrdunk'), false, 'Missing ID must not change an existing Snkrdunk series')
assert.equal(canFetchMercariPrice(null, 'mercari'), true)
assert.equal(canFetchMercariPrice(null), true)
assert.equal(canFetchMercariPrice(null, undefined, true), false)
assert.deepEqual(priceHistorySegments(refreshed), [[oldSample], [recentSample]])
assert.deepEqual(priceHistorySegments(refreshed).flat(), [...refreshed].reverse(), 'September observations remain visible')
assert.deepEqual(priceHistorySegments([recentSample, record('2026-09-01', 1, 'snkrdunk')]).map(s => s.length), [1, 1])
assert.deepEqual(priceHistorySegments([]), [])

const gapHistory = [record('2026-10-07', 33000, 'mercari'), record('2026-09-23', 57000, 'mercari')]
const gapDisplay = priceDisplayHistory(gapHistory, '2026-10-11', 90)
assert.equal(gapDisplay.length, 19)
assert.equal(gapDisplay.find(r => r.date === '2026-10-01')?.record.avg, 57000)
assert.equal(gapDisplay.find(r => r.date === '2026-10-01')?.observedDate, '2026-09-23')
assert.equal(gapDisplay.at(-1)?.record.avg, 33000)
assert.equal(gapDisplay.at(-1)?.observedDate, '2026-10-07')
assert.equal(gapHistory.length, 2, 'Display carries must not create observations or sales')
const switchedDisplay = priceDisplayHistory([record('2026-10-07', 99000, 'snkrdunk'), gapHistory[1]], '2026-10-11')
assert.equal(switchedDisplay.find(r => r.date === '2026-10-06')?.record.source, 'mercari')
assert.equal(switchedDisplay.find(r => r.date === '2026-10-07')?.record.source, 'snkrdunk')
assert.deepEqual(priceDisplayHistory([], '2026-10-11'), [])
assert.equal(priceDisplayHistory(gapHistory, '2026-09-01').length, 0, 'Never project a future price backwards')
assert.equal(priceDisplayHistory(gapHistory, '2026-10-11', 2).length, 3)

const boxSeries = fs.readdirSync('data/prices').filter(file => file.startsWith('box-') && file.endsWith('.json'))
  .map(file => ({ id: file.slice(0, -5), latest: JSON.parse(fs.readFileSync('data/prices/' + file, 'utf8')).history[0] }))
const scheduledBoxes = existingSnkrdunkBoxes(boxSeries)
for (const id of ['hot_wind_arena', 'jet_black_spirit', 'matchless_fighters']) assert.ok(scheduledBoxes.includes(id), id + ' must not be omitted from daily updates')
assert.equal(new Set(scheduledBoxes).size, scheduledBoxes.length)
assert.equal(existingSnkrdunkBoxes([{ id: 'box-test', latest: record('2026-10-03', 100, 'mercari') }]).length, 0)
assert.equal(hasNewBoxSales(record('2026-10-03', 100, 'snkrdunk'), ['2026-10-01'], '2026-10-11'), false)
assert.equal(hasNewBoxSales(record('2026-10-03', 100, 'snkrdunk'), ['2026-10-11'], '2026-10-11'), true)
