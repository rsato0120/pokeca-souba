import assert from 'node:assert/strict'
import fs from 'node:fs'
import catalog from '../data/pokeca_data.json'
import productIds from '../data/snkrdunk-ids.json'
import imageBounds from '../data/card-image-bounds.json'
import issuedLinks from '../data/mercari-x-links.json'
import { mercariXShareUrl } from '../src/lib/share-links'
import { usesDatedCardSales } from './vintage-card-sales'

// All secret-numbered cards plus the 12 ACE SPEC cards in these 11 SV sets.
// Card identity is checked against both TCGdex and SNKRDUNK at import.
const sets: Array<[string, number, number, number[]]> = [
  ['stellar_miracle', 102, 135, [94, 96, 101]],
  ['mask_of_change', 101, 133, [92, 93, 101]],
  ['wild_force', 71, 100, [62, 66, 71]],
  ['cyber_judge', 71, 100, [62, 63, 64]],
  ['ancient_roar', 66, 95, []], ['future_flash', 66, 95, []],
  ['raging_surf', 62, 92, []], ['snow_hazard', 71, 99, []],
  ['triplet_beat', 73, 103, []], ['scarlet_ex', 78, 108, []],
  ['violet_ex', 78, 108, []],
]
let total = 0, withRaw = 0, withPsa = 0, withoutTrades = 0
const seenProducts = new Set<number>()
for (const [boxId, official, last, aceNumbers] of sets) {
  const cards = catalog.cards.filter(card => card.box_id === boxId)
  const expected = [...aceNumbers, ...Array.from({ length: last - official }, (_, i) => official + i + 1)]
  assert.equal(cards.length, expected.length, `${boxId}: card count`)
  for (const number of expected) {
    const cardNo = `${String(number).padStart(3, '0')}/${String(official).padStart(3, '0')}`
    const matches = cards.filter(card => card.card_no === cardNo)
    assert.equal(matches.length, 1, `${boxId} ${cardNo}: missing or duplicate`)
    const card = matches[0]
    assert.ok(['AR', 'SR', 'SAR', 'UR', 'ACE'].includes(card.rarity))
    assert.equal(card.rarity === 'ACE', aceNumbers.includes(number))
    assert.ok(card.image_url && Object.hasOwn(imageBounds, card.image_url), `${card.id}: image bounds missing`)
    assert.ok(usesDatedCardSales(card.id), `${card.id}: dated price update missing`)
    const productId = (productIds as Record<string, number>)[card.id]
    assert.ok(productId && !seenProducts.has(productId), `${card.id}: missing or reused product`)
    seenProducts.add(productId)
    const issued = (issuedLinks as Record<string, { url: string; destination: string }>)[card.id]
    assert.ok(issued, `${card.id}: issued X affiliate URL missing`)
    assert.match(issued.url, /^https:\/\/r\.8to\.jp\/[A-Za-z0-9]{12}$/)
    assert.equal(mercariXShareUrl(card.id), issued.url)
    const destination = new URL(issued.destination)
    assert.equal(destination.origin, 'https://jp.mercari.com')
    assert.equal(destination.searchParams.get('keyword'), `${card.card_name} ${card.card_no}`)
    assert.equal(destination.searchParams.get('status'), 'on_sale')
    const file = `data/prices/${card.id}.json`
    if (fs.existsSync(file)) {
      const prices = JSON.parse(fs.readFileSync(file, 'utf8'))
      assert.equal(prices.card_id, card.id)
      for (const record of [...prices.history, ...(prices.psa10_history ?? [])]) {
        assert.equal(record.source, 'snkrdunk')
        assert.equal(record.price_basis, 'transaction_day')
      }
      if (prices.history.length) withRaw++
      if (prices.psa10_history?.length) withPsa++
    } else withoutTrades++
    total++
  }
}
assert.equal(total, 341)
console.log(JSON.stringify({ cards: total, withRaw, withPsa, withoutTrades, affiliateLinks: total }))
