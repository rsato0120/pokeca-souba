import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeVintageSales, usesDatedCardSales } from './vintage-card-sales'
import type { SnkrdunkSales } from './snkrdunk-sales'

const sales: SnkrdunkSales = { regular: ['2025-12-01'], psa10: ['2026-10-15'],
  regularSales: [{ date: '2025-12-01', price: 12000 }], psa10Sales: [{ date: '2026-10-15', price: 50000 }] }

test('older SV cards retain dated raw trades and independent recent PSA10 observations', () => {
  assert.ok(usesDatedCardSales('stellar-miracle-130'))
  assert.ok(usesDatedCardSales('scarlet-ex-099'))
  assert.equal(usesDatedCardSales('30th-celebration-130'), false)
  const data = mergeVintageSales({ card_id: 'stellar-miracle-130', history: [] }, sales, '2026-10-25')
  assert.equal(data.history[0].date, '2025-12-01')
  assert.equal(data.psa10_history?.[0].date, '2026-10-15')
  const psaOnly = mergeVintageSales({ card_id: 'stellar-miracle-131', history: [] }, { ...sales, regular: [], regularSales: [] }, '2026-10-25')
  assert.deepEqual(psaOnly.history, [])
  assert.equal(psaOnly.psa10_history?.[0].psa10, 50000)
})

test('starter prices reject high transaction totals without removing trades from volume', () => {
  const api = { ...sales, regularSales: [1000, 1100, 1200, 1200, 1300, 6200, 11111]
    .map(price => ({ date: '2026-10-20', price })) }
  const previous = { card_id: '30th-card-set-102', history: [] }
  const data = mergeVintageSales(previous, api, '2026-10-21')
  assert.equal(data.history[0].avg, 1160)
  assert.equal(data.history[0].low, 1000)
  assert.equal(data.history[0].high, 1300)
  assert.equal(data.history[0].sample_count, 5)
  assert.equal(data.sales_by_day?.['2026-10-20'], 7)
  assert.deepEqual(mergeVintageSales(data, api, '2026-10-21'), data)
  const vintage = mergeVintageSales({ ...previous, card_id: 'pcg6-test' }, api, '2026-10-21')
  assert.equal(vintage.history[0].sample_count, 7)
  assert.equal(vintage.history[0].high, 11111)
})

test('starter prices preserve sparse trades and follow a new day price level', () => {
  const api = { ...sales, regularSales: [
    { date: '2026-10-19', price: 1000 }, { date: '2026-10-19', price: 1200 },
    ...[3000, 3100, 3200].map(price => ({ date: '2026-10-20', price })),
  ] }
  const data = mergeVintageSales({ card_id: '30th-card-set-102', history: [] }, api, '2026-10-21')
  assert.equal(data.history[0].avg, 3100)
  assert.equal(data.history[1].avg, 1100)
})

test('a split starter distribution never produces an empty or invented price', () => {
  const api = { ...sales, regularSales: [1000, 1000, 10000, 10000]
    .map(price => ({ date: '2026-10-20', price })) }
  const data = mergeVintageSales({ card_id: '30th-card-set-102', history: [] }, api, '2026-10-21')
  assert.equal(data.history[0].avg, 5500)
  assert.equal(data.history[0].sample_count, 4)
})

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
