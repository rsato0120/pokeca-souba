import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseBoxListingCount } from './snkrdunk-box-listings'

test('対象商品の新品出品数をRSCから取得し、99+表示・関連商品・中古を混ぜない', () => {
  const payload = JSON.stringify({ related: { apparelData: { id: 123, listingCount: 9000 } }, apparelData: {
    id: 881421, name: '拡張パック「30th」 "BOX" }', primaryMedia: { id: 1 },
    listingCount: 1575, listingCountText: '99+', usedListingCount: 4,
  } })
  const html = `<script>self.__next_f.push(${JSON.stringify([1, payload])})</script>`
  assert.equal(parseBoxListingCount(html, 881421), 1575)
  assert.equal(parseBoxListingCount(html, 999), null)
})

test('実際の0件と取得失敗を区別する', () => {
  assert.equal(parseBoxListingCount('{"apparelData":{"id":1,"listingCount":0}}', 1), 0)
  for (const value of [null, -1, '99+', 1.5]) {
    assert.equal(parseBoxListingCount(JSON.stringify({ apparelData: { id: 1, listingCount: value } }), 1), null)
  }
  assert.equal(parseBoxListingCount('<html>error</html>', 1), null)
})
