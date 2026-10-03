import assert from 'node:assert/strict'
import { chainLink } from '../src/lib/index-series'
import { mercariAffiliateUrl, mercariDirectUrl } from '../src/lib/bargains'

// A thinly traded market can have 79 members but only 42 observations per day.
const members = Array.from({ length: 79 }, (_, i) => new Map<string, { value: number; source: 'snkrdunk' | 'mercari' }>(i < 42 ? [
  ['2026-10-01', { value: 10000, source: 'snkrdunk' as const }],
  ['2026-10-02', { value: 11000, source: 'snkrdunk' as const }],
] : [[new Date(Date.UTC(2026, 0, i)).toISOString().slice(0, 10), { value: 10000, source: 'snkrdunk' as const }]]))
assert.deepEqual(chainLink(members), []) // Pokemon's default conditions stay unchanged.
const recovered = chainLink(members, { baseCoverage: 0.4 })
assert.equal(recovered.length, 2)
assert.equal(recovered[0].value, 100)
assert.ok(Math.abs(recovered[1].value - 110) < 1e-8)
// The less demanding base day must not weaken source/outlier checks.
members[0].set('2026-10-02', { value: 1000000, source: 'snkrdunk' })
members[1].set('2026-10-02', { value: 11000, source: 'mercari' })
assert.equal(chainLink(members, { baseCoverage: 0.4 })[1].contributors, 40)
for (const url of ['https://jp.mercari.com/item/m123456', 'https://jp.mercari.com/search?keyword=%E3%83%AB%E3%83%95%E3%82%A3&status=on_sale']) {
  assert.equal(mercariDirectUrl(url), url)
  assert.equal(mercariDirectUrl(mercariAffiliateUrl(url)), url)
}
for (const url of ['javascript:alert(1)', 'https://jp.mercari.com.evil.example/item/m1', 'https://example.com', 'not a URL', mercariAffiliateUrl('https://example.com')]) {
  assert.equal(mercariDirectUrl(url), null)
}
console.log('Market recovery: sparse index, unchanged default, source checks and Mercari URLs OK')
