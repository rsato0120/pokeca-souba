import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buyMovement } from '../src/lib/buy-movement'
import type { PriceRecord } from '../src/types/pokeca'
import { selectBuyCandidates, type BuyInput } from '../src/lib/buy-signals'
import catalog from '../data/pokeca_data.json'

const records: PriceRecord[] = [
  { date: '2026-10-04', low: 900, high: 900, source: 'snkrdunk', sample_count: 8, on_sale: 80, on_sale_source: 'snkrdunk' },
  { date: '2026-10-03', low: 850, high: 850, source: 'snkrdunk', sample_count: 8, on_sale: 100, on_sale_source: 'snkrdunk' },
  { date: '2026-09-27', low: 1000, high: 1000, source: 'snkrdunk', sample_count: 8 },
]
test('fresh rebound and shrinking supply have explicit reasons', () => {
  const result = buyMovement(records, '2026-10-04')
  assert.ok(result.score > 0)
  assert.ok(result.reasons.includes('週間下落から反発'))
  assert.ok(result.reasons.includes('直近の出品数減少 20.0%'))
})
test('stale observations do not earn movement priority', () => {
  assert.equal(buyMovement(records, '2026-10-07').score, 0)
})
test('market switches and capped supply do not create movement', () => {
  const switched = records.map((r, i) => ({ ...r, source: i === 0 ? 'mercari' as const : r.source, on_sale_capped: true }))
  assert.equal(buyMovement(switched, '2026-10-04').score, 0)
})
test('thin trades do not create price movement', () => {
  assert.equal(buyMovement(records.map(r => ({ ...r, sample_count: 1, on_sale: undefined })), '2026-10-04').score, 0)
})

test('recent movement takes priority over static upside, but eligibility is preserved', () => {
  const card = { ...catalog.cards[0], rarity: 'SAR', materials: {
    ...catalog.cards[0].materials,
    player: { ...catalog.cards[0].materials.player, competitive_usage: 'none' },
  } } as BuyInput['card']
  const input = (slug: string, upPct: number, upside: number, history: PriceRecord[]): BuyInput => ({
    slug, card: { ...card, id: slug }, history, extremes: null,
    forecast: {
      card_no: card.card_no, rarity: card.rarity, generated_at: '2026-10-04', disclaimer: '',
      overall: { up_pct: upPct, down_pct: 10, flat_pct: 90 - upPct, reason: '' },
      price_forecast: { current_low: 1000, current_high: 1000, m3_low: upside, m3_high: upside,
        m1_low: upside, m1_high: upside, m6_low: upside, m6_high: upside,
        up_low: upside, up_high: upside, down_low: 900, down_high: 900 },
    },
  })
  const inputs = [input('static', 90, 1500, []), input('moving', 70, 1100, records), input('ineligible', 20, 1600, records)]
  const picks = selectBuyCandidates(inputs, 9, 2, undefined, '2026-10-04')
  assert.deepEqual(picks.map(p => p.slug), ['moving', 'static'])
  assert.deepEqual(selectBuyCandidates(inputs, 9, 2, undefined, '2026-10-07').map(p => p.slug), ['static', 'moving'])
})
