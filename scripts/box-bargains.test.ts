import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchesSingleBox, assessBoxBargain, buildBoxDeals, type BoxMarketListings } from '@/lib/box-bargains'
import type { Box, PriceRecord } from '@/types/pokeca'

const box = { box_id: 'test', box_name: 'テラスタルフェスex', certainty: 'released', packs_per_box: 10 } as Box
const title = 'テラスタルフェスex 1BOX シュリンク付き'
test('同一商品・単箱・同じシュリンク状態のみ比較する', () => {
  assert.equal(matchesSingleBox(title, box, 'shrink', [box]), true)
  assert.equal(matchesSingleBox('テラスタルフェスex １ＢＯＸ 未開封 シュリンクなし', box, 'noshrink', [box]), true)
  for (const invalid of [title.replace('1BOX', '2BOX'), `${title} 空箱`, `${title} 再シュリンク`, `${title} 2箱`, `${title} ×2`, `${title} プロモセット`, title.replace('付き', 'なし'), title.replace('1BOX', 'BOX'), `${title} パックのみ`]) {
    assert.equal(matchesSingleBox(invalid, box, 'shrink', [box]), false, invalid)
  }
  const other = { ...box, box_id: 'other', box_name: 'クレイバースト' }
  assert.equal(matchesSingleBox(`${title} クレイバースト`, box, 'shrink', [box, other]), false)
})
test('小さすぎる値引き・極端な安値を除外する', () => {
  assert.ok(assessBoxBargain(9500, 10000))
  for (const price of [9900, 5000, 10000, NaN, Infinity]) assert.equal(assessBoxBargain(price, 10000), null)
})
test('取得から24時間を超える出品・古い相場・異なる状態を掲載しない', () => {
  const now = Date.parse('2026-09-03T03:00:00Z')
  const data: BoxMarketListings = { updated_at: new Date(now).toISOString(), groups: [{ box_id: box.box_id, variant: 'shrink', fetched_at: new Date(now).toISOString(), listings: [{ id: 'm123', title, price: 9000, url: 'https://jp.mercari.com/item/m123' }] }] }
  const latest = { date: '2026-09-03', low: 9800, high: 10200 } as PriceRecord
  assert.equal(buildBoxDeals(data, [box], (_id, variant) => variant === 'shrink' ? latest : undefined, now).length, 1)
  assert.equal(buildBoxDeals(data, [box], () => latest, now + 25 * 3600000).length, 0)
  assert.equal(buildBoxDeals(data, [box], () => ({ ...latest, date: '2026-08-20' }), now).length, 0)
  assert.equal(buildBoxDeals(data, [box], () => undefined, now).length, 0)
  data.groups[0].variant = 'noshrink'
  assert.equal(buildBoxDeals(data, [box], () => latest, now).length, 0)
})
