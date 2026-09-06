import assert from 'node:assert/strict'
import { getAllCards, getAllBoxes } from '../src/lib/data'
import { getOnePieceCatalog } from '../src/lib/onepiece'
const cards = getAllCards()
assert.equal(new Set(cards.map(c => c.id)).size, cards.length)
for (const box of getAllBoxes().filter(b => b.certainty === 'released' && b.packs_per_box)) {
  assert.ok(cards.some(c => c.box_id === box.box_id), `Released BOX has no cards: ${box.box_id}`)
}
const arcana = cards.filter(c => c.box_id === 'incandescent_arcana')
assert.ok(getAllBoxes().some(b => b.box_id === 'incandescent_arcana'))
assert.ok(arcana.length >= 10, 'White Arcana BOX must have its registered cards')
assert.ok(arcana.every(c => c.card_no.endsWith('/068') && c.image_url))
const { products } = getOnePieceCatalog()
for (const box of products.filter(p => p.kind === 'box')) {
  assert.ok(products.some(p => p.kind === 'card' && p.set_id === box.set_id), `BOX has no cards: ${box.id}`)
}
const op05 = products.filter(p => p.set_id === 'op05' && p.kind === 'card')
assert.ok(op05.length >= 10, 'OP05 BOX must have its registered cards')
assert.ok(op05.every(p => p.name.includes('新時代の主役') && p.image_url && p.card_no))
assert.equal(new Set(op05.map(p => p.snkrdunk_id)).size, op05.length)
assert.ok(op05.some(p => p.card_no === 'ST01-012'), 'Reprinted card numbers retain the containing BOX association')
assert.ok(!op05.some(p => p.id.startsWith('promo-')), 'Separate promos do not become BOX contents')
console.log(`BOX contents verified: Arcana ${arcana.length}, OP05 ${op05.length}`)
