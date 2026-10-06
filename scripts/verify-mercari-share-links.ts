import assert from 'node:assert/strict'
import catalog from '../data/pokeca_data.json'
import links from '../data/mercari-x-links.json'

const issued = links as Record<string, { url: string; destination: string }>
for (const card of catalog.cards) {
  const entry = issued[card.id]
  assert.ok(entry, `A8でX用リンクを発行してください: ${card.id}`)
  assert.match(entry.url, /^https:\/\/r\.8to\.jp\/[A-Za-z0-9]{12}$/)
  const destination = new URL(entry.destination)
  assert.equal(destination.origin, 'https://jp.mercari.com')
  assert.equal(destination.pathname, '/search/')
  assert.equal(destination.searchParams.get('status'), 'on_sale')
  assert.equal(destination.searchParams.get('keyword'), `${card.card_name} ${card.card_no || card.rarity}`.trim())
}
assert.equal(Object.keys(issued).length, catalog.cards.length)
assert.equal(new Set(Object.values(issued).map(entry => entry.url)).size, catalog.cards.length)
console.log(`All ${catalog.cards.length} cards have issued X affiliate links and matching searches`)