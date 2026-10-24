import assert from 'node:assert/strict'
import catalog from '../data/pokeca_data.json'
import links from '../data/mercari-x-links.json'
import { mercariXShareUrl, mercariBoxXShareUrl } from '../src/lib/share-links'

const issued = links as Record<string, { url: string; destination: string }>
let checked = 0
for (const card of catalog.cards) {
  const entry = issued[card.id]
  if (!entry && (card.box_id.startsWith('bw_') || /^(pcg[6-9]-|pmcg1-|mg-)/.test(card.id) || card.box_id === 'alter_genesis')) continue
  assert.ok(entry, `A8でX用リンクを発行してください: ${card.id}`)
  assert.match(entry.url, /^https:\/\/r\.8to\.jp\/[A-Za-z0-9]{12}$/)
  assert.equal(mercariXShareUrl(card.id), entry.url, `Issued URL must be included unchanged: ${card.id}`)
  const destination = new URL(entry.destination)
  assert.equal(destination.origin, 'https://jp.mercari.com')
  assert.equal(destination.pathname, '/search/')
  assert.equal(destination.searchParams.get('status'), 'on_sale')
  assert.equal(destination.searchParams.get('keyword'), `${card.card_name} ${card.card_no || card.rarity}`.trim())
  checked++
}
for (const [id, entry] of Object.entries(issued).filter(([id]) => id.startsWith('box-'))) {
  const box = catalog.boxes.find(box => `box-${box.box_id}` === id)
  assert.ok(box, `Unknown BOX affiliate link: ${id}`)
  assert.equal(mercariBoxXShareUrl(box.box_id), entry.url)
  assert.match(entry.url, /^https:\/\/r\.8to\.jp\/[A-Za-z0-9]{12}$/)
  const destination = new URL(entry.destination)
  assert.equal(destination.origin, 'https://jp.mercari.com')
  assert.equal(destination.pathname, '/search/')
  assert.equal(destination.searchParams.get('status'), 'on_sale')
  assert.equal(destination.searchParams.get('keyword'), `${box.box_name} BOX`)
  checked++
}
assert.equal(Object.keys(issued).length, checked)
assert.equal(new Set(Object.values(issued).map(entry => entry.url)).size, checked)
console.log(`${checked} issued X affiliate links verified; new BW and PCG Delta Species cards share without affiliate links`)

const starters = catalog.cards.filter(card => card.id.startsWith('30th-card-set-'))
assert.equal(starters.length, 27)
for (const card of starters) {
  assert.match(mercariXShareUrl(card.id) ?? '', /^https:\/\/r\.8to\.jp\/[A-Za-z0-9]{12}$/, `Starter promo X affiliate URL missing: ${card.id}`)
}
assert.equal(mercariXShareUrl('30th-card-set-102'), 'https://r.8to.jp/jTUpS62FNbNz')
