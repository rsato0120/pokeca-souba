import assert from 'node:assert/strict'
import { canUsePriceSource, currentPriceSeries, priceSeriesKey } from '../src/lib/price-source'
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
