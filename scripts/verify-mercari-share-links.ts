import assert from 'node:assert/strict'
import catalog from '../data/pokeca_data.json'
import links from '../data/mercari-x-links.json'

const issued = links as Record<string, { url: string; destination: string }>
let checked = 0
for (const card of catalog.cards) {
  const entry = issued[card.id]
  if (!entry && card.box_id.startsWith('bw_')) continue
  assert.ok(entry, `A8でX用リンクを発行してください: ${card.id}`)
  assert.match(entry.url, /^https:\/\/r\.8to\.jp\/[A-Za-z0-9]{12}$/)
  const destination = new URL(entry.destination)
  assert.equal(destination.origin, 'https://jp.mercari.com')
  assert.equal(destination.pathname, '/search/')
  assert.equal(destination.searchParams.get('status'), 'on_sale')
  assert.equal(destination.searchParams.get('keyword'), `${card.card_name} ${card.card_no || card.rarity}`.trim())
  checked++
}
assert.equal(Object.keys(issued).length, checked)
assert.equal(new Set(Object.values(issued).map(entry => entry.url)).size, checked)
console.log(`${checked} issued X affiliate links verified; new BW cards share without affiliate links`)
