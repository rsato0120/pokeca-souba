import assert from 'node:assert/strict'
import { boxTitleFilter, matchesCardNo, parseCardNo } from './scrape-prices'
const match = boxTitleFilter(['トウホク', '東北'], 'any', ['フクオカ', 'ヒロシマ'], ['スペシャル'])
assert.ok(match('スペシャルBOX ポケモンセンタートウホク 未開封'))
for (const title of ['ポケモンセンタートウホク産 未開封BOX', 'スペシャルBOX トウホク 2個', 'スペシャルBOX トウホク サプライ', 'スペシャルBOX トウホク デッキシールド', 'スペシャルBOX トウホク フクオカ', 'スペシャルBOX トウホク 開封済']) assert.equal(match(title), false, title)
const no = parseCardNo('147/S-P')
assert.ok(matchesCardNo('カナザワのピカチュウ 147/S-P', no))
assert.ok(matchesCardNo('カナザワのピカチュウ S-P 147', no))
assert.equal(matchesCardNo('カナザワのピカチュウ 144/S-P', no), false)
assert.equal(matchesCardNo('カナザワのピカチュウ', no), false)
assert.equal(matchesCardNo('144/S-P 147/S-P 2枚', no), false)
console.log('Special BOX title filtering and S-P variant matching OK')
