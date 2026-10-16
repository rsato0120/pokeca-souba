import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeVintageSales } from './vintage-card-sales'
import type { SnkrdunkSales } from './snkrdunk-sales'

const sales: SnkrdunkSales = { regular: ['2025-12-01'], psa10: ['2026-10-15'],
  regularSales: [{ date: '2025-12-01', price: 12000 }], psa10Sales: [{ date: '2026-10-15', price: 50000 }] }

test('a thin vintage trade keeps its real date and PSA10 is stored independently', () => {
  const data = mergeVintageSales({ card_id: 'pcg6-test', history: [] }, sales, '2026-10-16')
  assert.equal(data.history[0].date, '2025-12-01')
  assert.equal(data.history[0].avg, 12000)
  assert.equal(data.history[0].sample_count, 1)
  assert.equal(data.history[0].psa10, undefined)
  assert.equal(data.psa10_history?.[0].date, '2026-10-15')
  assert.equal(data.psa10_history?.[0].psa10, 50000)
  assert.deepEqual(mergeVintageSales(data, sales, '2026-10-16'), data)
})

test('PSA10-only observations do not create a zero or borrowed raw price', () => {
  const data = mergeVintageSales({ card_id: 'pcg6-test', history: [] }, { ...sales, regular: [], regularSales: [] }, '2026-10-16')
  assert.deepEqual(data.history, [])
  assert.equal(data.psa10_history?.[0].psa10, 50000)
})

test('missing, non-positive and future trades cannot replace valid history', () => {
  const previous = mergeVintageSales({ card_id: 'pcg6-test', history: [] }, sales, '2026-10-16')
  const next = mergeVintageSales(previous, { regular: [], psa10: [], psa10Sales: [], regularSales: [
    { date: '2026-10-17', price: 999 }, { date: '2025-12-01', price: 0 },
  ] }, '2026-10-16')
  assert.deepEqual(next, previous)
  assert.throws(() => mergeVintageSales(previous, { ...sales, regularComplete: false }, '2026-10-16'), /未完了/)
})
