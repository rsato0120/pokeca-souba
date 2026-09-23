import assert from 'node:assert/strict'
import { priceChangePct, priceChangePctForDays } from '../src/lib/price-change'
import type { PriceRecord, PriceSource } from '../src/types/pokeca'

const record = (avg: number, source?: PriceSource): PriceRecord => ({ date: '2026-09-14', avg, low: avg, high: avg, source })
for (const source of ['mercari', 'snkrdunk'] as const) {
  const other = source === 'mercari' ? 'snkrdunk' : 'mercari'
  assert.equal(priceChangePct([record(110, source), record(100, source)], 1, 20), 10)
  assert.equal(priceChangePct([record(90, source), record(100, source)], 1, 20), -10)
  const switched = [record(110, source), ...Array.from({ length: 7 }, () => record(100, other))]
  assert.equal(priceChangePct(switched, 1, 20) ?? priceChangePct(switched, 7, 35), null)
  switched[7] = record(100, source)
  assert.equal(priceChangePct(switched, 7, 35), null)
  switched[1] = record(100, source)
  assert.equal(priceChangePct(switched, 1, 20), 10)
  const stable = Array.from({ length: 8 }, () => record(100, source))
  stable[0] = record(110, source)
  assert.equal(priceChangePct(stable, 7, 35), 10)
}
assert.equal(priceChangePct([record(110), record(100)], 1, 20), null)
assert.equal(priceChangePct([record(110, 'mercari'), record(100)], 1, 20), null)
assert.equal(priceChangePct([], 1, 20), null)
assert.equal(priceChangePct([record(110, 'mercari')], 7, 35), null)
for (const baseline of [0, NaN, Infinity]) {
  assert.equal(priceChangePct([record(110, 'mercari'), record(baseline, 'mercari')], 1, 20), null)
}
assert.equal(priceChangePct([record(150, 'mercari'), record(100, 'mercari')], 1, 20), null)

const dated = (date: string, avg: number, source: PriceSource = 'snkrdunk', sample_count = 6): PriceRecord =>
  ({ date, avg, low: avg, high: avg, source, sample_count })
assert.equal(priceChangePctForDays([
  dated('2026-09-22', 90), dated('2026-09-21', 100),
], 1, 1, 20, 6), -10)
assert.equal(priceChangePctForDays([
  dated('2026-09-22', 90), dated('2026-09-13', 100),
], 6, 8, 35, 6), null, '9日前の観測は7日比に使わない')
assert.equal(priceChangePctForDays([
  dated('2026-09-22', 90, 'snkrdunk', 4), dated('2026-09-21', 100),
], 1, 1, 20, 6), null, '少数成約のスニダン価格はランキングに使わない')
assert.equal(priceChangePctForDays([
  { ...dated('2026-09-22', 90, 'mercari'), oldest_sale_days: 84 }, dated('2026-09-21', 100, 'mercari'),
], 1, 1, 20), null, '古い成約を含むメルカリ平均は直近の値動きに使わない')
console.log('price change source-switch regression checks: OK')
