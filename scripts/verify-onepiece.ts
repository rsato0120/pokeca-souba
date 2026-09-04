import assert from 'node:assert/strict'
import { buildOnePieceHistory, parseOnePieceSale } from './onepiece-price-utils'
import { getOnePieceCatalog } from '../src/lib/onepiece'
import { isActiveTab, navItemsFor } from '../src/lib/nav'

const now = Date.parse('2026-09-04T12:00:00+09:00')
const raw = { date: '2026/09/03', price: 12000, condition: 'A', size: '' }
assert.equal(parseOnePieceSale(raw, 'card', now)?.price, 12000)
assert.equal(parseOnePieceSale({ ...raw, condition: 'PSA10' }, 'card', now), null)
assert.equal(parseOnePieceSale({ ...raw, condition: 'B' }, 'card', now), null)
assert.equal(parseOnePieceSale({ ...raw, price: NaN }, 'card', now), null)
assert.equal(parseOnePieceSale({ ...raw, size: '4個' }, 'box', now)?.price, 3000)
assert.equal(parseOnePieceSale({ ...raw, size: 'カートン' }, 'box', now), null)
assert.equal(parseOnePieceSale({ ...raw, size: '' }, 'box', now), null)
const sales = [{ date: '2026-09-03', price: 10000 }, { date: '2026-09-03', price: 12000 }, { date: '2026-09-02', price: 8000 }]
assert.equal(buildOnePieceHistory(sales)[0].avg, 10000)
assert.equal(buildOnePieceHistory(sales)[0].date, '2026-09-03')
assert.equal(buildOnePieceHistory(sales)[0].sample_count, 3)
assert.equal(buildOnePieceHistory(sales.slice(0, 2)).length, 0)
assert.equal(buildOnePieceHistory([...sales, { date: '2026-07-01', price: 999999 }])[0].avg, 10000)
const { sets, products } = getOnePieceCatalog()
assert.equal(sets.length, 5)
assert.equal(new Set(products.map(p => p.snkrdunk_id)).size, products.length)
for (const set of sets) {
  assert.match(set.release_date, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(products.filter(p => p.set_id === set.id && p.kind === 'box').length, 1)
  assert.ok(products.filter(p => p.set_id === set.id && p.kind === 'card').length >= 6)
}
assert.equal(navItemsFor('/onepiece/cards').filter(n => isActiveTab(n, '/onepiece/cards')).length, 1)
assert.ok(navItemsFor('/onepiece').every(n => n.href.startsWith('/onepiece')))
assert.ok(navItemsFor('/').every(n => !n.href.startsWith('/onepiece')))
console.log(`ONE PIECE: sale filtering, BOX units, history, navigation, ${sets.length} sets / ${products.length} products OK`)
