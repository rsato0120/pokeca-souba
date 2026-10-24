import assert from 'node:assert/strict'
import fs from 'node:fs'
import catalog from '../data/pokeca_data.json'
import ids from '../data/snkrdunk-ids.json'
import { mercariBoxXShareUrl } from '../src/lib/share-links'

// Official standard expansion BOX lineup (SV + MEGA), checked 2026-10-25.
// https://www.pokemon-card.com/rules/regulation/sv.html
// https://www.pokemon-card.com/rules/regulation/mega.html
const svCodes = ['SV1S', 'SV1V', 'SV1a', 'SV2P', 'SV2D', 'SV2a', 'SV3', 'SV3a', 'SV4K', 'SV4M', 'SV4a', 'SV5K', 'SV5M', 'SV5a', 'SV6', 'SV6a', 'SV7', 'SV7a', 'SV8', 'SV8a', 'SV9', 'SV9a', 'SV10', 'SV11B', 'SV11W']
const megaIds = ['mega_brave', 'mega_symphonia', 'inferno_x', 'mega_dream_ex', 'munikiss_zero', 'ninja_spinner', 'abyss_eye', 'storm_emeralda', '30th_celebration']
for (const code of svCodes) assert.equal(catalog.boxes.filter(box => box.code.toLowerCase() === code.toLowerCase()).length, 1, `Missing or duplicate SV BOX: ${code}`)
for (const id of megaIds) assert.equal(catalog.boxes.filter(box => box.box_id === id).length, 1, `Missing or duplicate MEGA BOX: ${id}`)

const additions = ['stellar_miracle', 'mask_of_change', 'wild_force', 'cyber_judge', 'ancient_roar', 'future_flash', 'raging_surf', 'snow_hazard', 'triplet_beat', 'scarlet_ex', 'violet_ex']
for (const id of additions) {
  const box = catalog.boxes.find(box => box.box_id === id)
  assert.ok(box?.pack_image_url && box.release_date, `BOX metadata missing: ${id}`)
  assert.match(mercariBoxXShareUrl(id) ?? '', /^https:\/\/r\.8to\.jp\/[A-Za-z0-9]{12}$/, `Issued X affiliate URL missing: ${id}`)
  const series = `box-${id}-shrink`
  assert.ok((ids as Record<string, number>)[series], `Product ID missing: ${series}`)
  const prices = JSON.parse(fs.readFileSync(`data/prices/${series}.json`, 'utf8'))
  assert.equal(prices.card_id, series)
  assert.equal(prices.history[0].source, 'snkrdunk')
  assert.ok(prices.history[0].low > 0 && prices.history[0].high >= prices.history[0].low, `Invalid BOX price: ${series}`)
}
console.log('34 standard SV/MEGA BOX products present; all 11 additions have images, prices and issued X affiliate links')
