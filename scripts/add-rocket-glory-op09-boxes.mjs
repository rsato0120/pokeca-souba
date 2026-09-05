import fs from 'node:fs'

const pokePath = 'data/pokeca_data.json'
const idsPath = 'data/snkrdunk-ids.json'
const opPath = 'data/onepiece/catalog.json'

const poke = JSON.parse(fs.readFileSync(pokePath, 'utf8'))
const rocket = {
  box_id: 'rocket_glory',
  box_name: 'ロケット団の栄光',
  code: 'SV10',
  release_ym: '2025-04',
  certainty: 'released',
  pack_price_yen: 180,
  packs_per_box: 30,
  pack_image_url: 'https://cdn.snkrdunk.com/upload_bg_removed/20250417083341-0.webp?size=l',
  note: '2025-04-18発売。ロケット団のポケモンをテーマにした拡張パック。ロケット団のミュウツーex SAR、ロケット団のファイヤーex SAR、ロケット団のサカキ SARなどを収録。',
}
poke.boxes = poke.boxes.filter(box => box.box_id !== rocket.box_id)
const rocketAt = poke.boxes.findIndex(box => box.release_ym < rocket.release_ym)
poke.boxes.splice(rocketAt < 0 ? poke.boxes.length : rocketAt, 0, rocket)
fs.writeFileSync(pokePath, JSON.stringify(poke, null, 2) + '\n')

const ids = JSON.parse(fs.readFileSync(idsPath, 'utf8'))
ids['box-rocket_glory-shrink'] = 550896
ids['box-rocket_glory-noshrink'] = 567450
fs.writeFileSync(idsPath, JSON.stringify(ids, null, 2) + '\n')

const op = JSON.parse(fs.readFileSync(opPath, 'utf8'))
const set = {
  id: 'op09',
  code: 'OP-09',
  name: '新たなる皇帝',
  official_url: 'https://www.onepiece-cardgame.com/products/boosters/op09.php',
  release_date: '2024-08-31',
  selection_url: 'https://snkrdunk.com/search?keywords=%E6%96%B0%E3%81%9F%E3%81%AA%E3%82%8B%E7%9A%87%E5%B8%9D',
}
const product = {
  id: 'op09-299926',
  set_id: 'op09',
  kind: 'box',
  name: '新たなる皇帝 未開封BOX',
  card_no: null,
  snkrdunk_id: 299926,
  image_url: 'https://cdn.snkrdunk.com/upload_bg_removed/20240828053218-1.webp',
  source_url: 'https://snkrdunk.com/apparels/299926',
  image_scale: 1,
}
op.sets = op.sets.filter(item => item.id !== set.id)
op.sets.push(set)
op.products = op.products.filter(item => item.id !== product.id)
op.products.push(product)
fs.writeFileSync(opPath, JSON.stringify(op, null, 2) + '\n')

console.log('ロケット団の栄光BOXと新たなる皇帝BOXを登録しました')
