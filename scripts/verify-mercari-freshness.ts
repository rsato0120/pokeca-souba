import assert from 'node:assert/strict'
import { selectMercariSales, shouldHoldStaleMercariPrice } from './scrape-prices'

const fresh = [0, 1, 7, 20, 30].map(ageDays => ({ ageDays, price: 1000 }))
const old = [31, 50, 89].map(ageDays => ({ ageDays, price: 500 }))
const previous = { date: '2026-09-23', avg: 1000, low: 900, high: 1100, source: 'mercari' as const }
// 90日分を先に平均すると古い成約が混じり、十分な直近成約があっても更新停止する。
const selected = selectMercariSales([...fresh, ...old])
assert.equal(selected.windowDays, 30)
assert.deepEqual(selected.picked, fresh)
assert.equal(shouldHoldStaleMercariPrice(previous, Math.max(...selected.picked.map(s => s.ageDays))), false)
// 直近が不足している時は古い平均で既存の観測日を進めない。
const thin = selectMercariSales([...fresh.slice(0, 2), ...old])
assert.equal(thin.windowDays, 90)
assert.equal(shouldHoldStaleMercariPrice(previous, Math.max(...thin.picked.map(s => s.ageDays))), true)
assert.deepEqual(selectMercariSales([{ ageDays: null }, { ageDays: 1 }]).picked, [])
console.log('Mercari freshness regression checks: OK')
