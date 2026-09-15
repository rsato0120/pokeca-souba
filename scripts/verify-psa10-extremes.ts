import assert from 'node:assert/strict'
import { computePsa10Extremes } from '../src/lib/psa10-extremes'
import type { PriceRecord } from '../src/types/pokeca'

const record = (date: string, psa10?: number | null): PriceRecord => ({ date, psa10, avg: 999999, low: 1, high: 999999, source: 'mercari', sample_count: 1 })
const history = [record('2026-09-14', 1500), record('2026-09-13', null), record('2026-09-12', 2000), record('2026-09-11', 1000)]
const extremes = computePsa10Extremes(history)!
assert.equal(extremes.high.value, 2000)
assert.equal(extremes.high.date, '2026-09-12')
assert.equal(extremes.low.value, 1000)
assert.equal(extremes.low.date, '2026-09-11')
assert.equal(extremes.high.source, 'snkrdunk')
assert.equal(extremes.since, '2026-09-11')
assert.equal(extremes.records, 3)
assert.equal(computePsa10Extremes([]), null)
assert.equal(computePsa10Extremes([record('2026-09-14'), record('2026-09-13', 0), record('2026-09-12', NaN), record('2026-09-11', Infinity), record('2026-09-10', -1)]), null)
// 保存窓から落ちた極値を引き継ぎ、重複して渡されても件数が増えない。
const archived = computePsa10Extremes(history.slice(2))!
assert.deepEqual(computePsa10Extremes(history.slice(0, 2), archived), extremes)
assert.deepEqual(computePsa10Extremes(history, archived), extremes)
assert.deepEqual(computePsa10Extremes([], archived), archived)
// 現存履歴の同日訂正は再計算され、訂正前の最高値を残さない。
const corrected = [record('2026-09-14', 2500), ...history.slice(1)]
assert.equal(computePsa10Extremes(corrected)!.high.value, 2500)
corrected[0] = record('2026-09-14', 1200)
assert.equal(computePsa10Extremes(corrected)!.high.value, 2000)
assert.equal(computePsa10Extremes([record('2026-09-15', 1000)], archived)!.low.date, '2026-09-11')
assert.equal(computePsa10Extremes([record('2026-09-14', 1500)])!.high.value, 1500)
assert.equal(computePsa10Extremes([history[0], history[0]])!.records, 1)
console.log('PSA10 extremes regression checks: OK')
