import assert from 'node:assert/strict'
import { buildOnePieceRanking } from '../src/lib/onepiece-ranking'
import type { OnePiecePrices, OnePieceProduct } from '../src/types/onepiece'

const product: OnePieceProduct = { id: 'op13-1', set_id: 'op13', kind: 'card', name: 'Test', card_no: 'OP13-001', snkrdunk_id: 1, image_url: null, source_url: '' }
const record = (date: string, avg: number) => ({ date, avg, low: avg, high: avg, source: 'snkrdunk' as const })
const data: OnePiecePrices = {
  product_id: product.id, fetched_at: '2026-09-05T22:00:00Z', complete: true, coverage_start: '2026-08-01',
  history: [record('2026-09-06', 120), record('2026-09-04', 80), record('2026-08-30', 100)],
  sales_by_day: { '2026-08-30': 99, '2026-08-31': 2, '2026-09-06': 3, '2026-09-07': 99 },
}
const build = (value: OnePiecePrices) => buildOnePieceRanking([product], { [product.id]: value })
const result = build(data)
assert.equal(result.baseDate, '2026-09-06', 'JSTの基準日')
assert.equal(result.rows[0].sales7d, 5, '7日間の両端だけを含み、未来は除外')
assert.equal(result.rows[0].day, null, '欠測を前日比にしない')
assert.ok(Math.abs(result.rows[0].week! - 20) < 0.0001)
assert.equal(build({ ...data, history: [record('2026-08-01', 100)] }).rows.length, 0, '古い価格は除外')
assert.equal(build({ ...data, history: [record('2026-09-06', 0)] }).rows.length, 0, 'ゼロ価格は除外')
assert.equal(build({ ...data, history: [record('2026-09-05', 120), record('2026-08-30', 100)] }).rows[0].week, null, '基準日に記録がない商品は比較しない')
assert.equal(buildOnePieceRanking([product], {}).rows.length, 0)
console.log('ONE PIECE ranking: all checks passed')
