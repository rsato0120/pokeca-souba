import fs from 'node:fs'

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')

const pokemon = read('data/pokeca_data.json')
const ids = read('data/snkrdunk-ids.json')
const onepiece = read('data/onepiece/catalog.json')

const box = {
  box_id: 'space_juggler', box_name: 'スペースジャグラー', code: 'S10P',
  release_ym: '2022-04', certainty: 'released', pack_price_yen: 165, packs_per_box: 30,
  pack_image_url: 'https://cdn.snkrdunk.com/upload_bg_removed/5d85eb64-73ab-491a-b2f1-c8ccd30d0f5e.webp?size=l',
  note: '2022年4月8日発売。1パック5枚入り、1BOX30パック。公式商品情報：https://www.pokemon-card.com/ex/s10/index.html',
}

const cardRows = [
  [69, 'SR', 'スピアーV', '草', 'たね', 210, 'Narumi Sato', 96640, 'https://cdn.snkrdunk.com/upload_bg_removed/7031f009-5b59-41fb-94d8-2521805ac715.webp'],
  [71, 'SR', 'オリジンパルキアV', '水', 'たね', 220, 'Oswaldo KATO', 91141, 'https://cdn.snkrdunk.com/upload_bg_removed/b321cb04-92c6-42fb-9027-136aa8fb1cbe.webp'],
  [75, 'SR', 'ヒスイ オオニューラV', '悪', 'たね', 190, 'OKACHEKE', 96646, 'https://cdn.snkrdunk.com/upload_bg_removed/c5549606-cdb1-4526-a9a2-a06873c8e8e3.webp'],
  [77, 'SR', 'カイ', 'サポート', 'サポート', 0, 'kirisAki', 91142, 'https://cdn.snkrdunk.com/upload_bg_removed/f6533466-8f11-40bf-baa0-de526230a873.webp'],
  [88, 'UR', 'ダブルターボエネルギー', 'エネルギー', '特殊エネルギー', 0, '', 91144, 'https://cdn.snkrdunk.com/upload_bg_removed/37dbd8f6-4aca-48c6-8ae9-57005c36e834.webp'],
]

const cards = cardRows.map(([no, rarity, name, type, stage, hp, illustrator, snkrdunkId, image]) => ({
  id: `space-juggler-${no}`, card_no: `${String(no).padStart(3, '0')}/067`, rarity,
  card_name: name, box_id: box.box_id, is_reprint: false, image_url: `${image}?size=l`,
  card_spec: { type, stage, hp, note: `スペースジャグラー収録・${rarity}。` },
  materials: {
    player: { regulation_mark: 'F', rotation: 'rotated', competitive_usage: 'none' },
    collector: { illustrator, illustrator_popularity: 'unknown', artwork_type: 'original', rarity },
    common: { reprint_status: 'none', scarcity: 'normal', character_popularity: /カイ|パルキア/.test(name) ? 'high' : 'unknown' },
  },
  evidence_notes: {
    player: 'ソード＆シールド期・レギュレーションマークF。',
    collector: `${name}の${rarity}版。`,
    source: `TCGdex（S10P-${String(no).padStart(3, '0')}）とスニダン商品番号${snkrdunkId}を照合して2026-09-25登録。`,
  },
  note: 'スペースジャグラーの主要収録カード。',
  _snkrdunkId: snkrdunkId,
}))

pokemon.boxes = pokemon.boxes.filter(item => item.box_id !== box.box_id)
pokemon.boxes.push(box)
const cardIds = new Set(cards.map(card => card.id))
pokemon.cards = pokemon.cards.filter(card => !cardIds.has(card.id))
for (const card of cards) {
  const { _snkrdunkId, ...saved } = card
  pokemon.cards.push(saved)
  ids[saved.id] = _snkrdunkId
}
ids['box-space_juggler-shrink'] = 66739

const opSet = {
  id: 'op03', code: 'OP-03', name: '強大な敵', release_date: '2023-02-11',
  official_url: 'https://www.onepiece-cardgame.com/products/boosters/op03/',
  selection_url: 'https://snkrdunk.com/apparels/136033',
}
const opProducts = [
  {
    id: 'op03-112979', set_id: 'op03', kind: 'card',
    name: 'そげキング SEC-SP (コミパラ) [OP03-122](ブースターパック「強大な敵」)',
    card_no: 'OP03-122', snkrdunk_id: 112979,
    image_url: 'https://cdn.snkrdunk.com/upload_bg_removed/211843c8-b5d5-461b-a305-c5d38294f25b.webp?size=l',
    image_scale: 1, source_url: 'https://snkrdunk.com/apparels/112979',
  },
  {
    id: 'op03-136033', set_id: 'op03', kind: 'box', name: '強大な敵 未開封BOX',
    card_no: null, snkrdunk_id: 136033,
    image_url: 'https://cdn.snkrdunk.com/upload_bg_removed/c649c51a-0b5d-48bd-b77d-32a4b7c4b029.webp?size=l',
    image_scale: 1, source_url: 'https://snkrdunk.com/apparels/136033',
  },
]
onepiece.sets = onepiece.sets.filter(set => set.id !== opSet.id)
const promoIndex = onepiece.sets.findIndex(set => set.id === 'promo')
onepiece.sets.splice(promoIndex < 0 ? onepiece.sets.length : promoIndex, 0, opSet)
const opIds = new Set(opProducts.map(product => product.id))
onepiece.products = onepiece.products.filter(product => !opIds.has(product.id))
onepiece.products.push(...opProducts)

write('data/pokeca_data.json', pokemon)
write('data/snkrdunk-ids.json', ids)
write('data/onepiece/catalog.json', onepiece)
console.log(`追加完了: ${box.box_name}（主要カード${cards.length}枚） / ${opSet.name}（主要カード1枚）`)
