import fs from 'node:fs'

const dataPath = 'data/pokeca_data.json'
const idsPath = 'data/snkrdunk-ids.json'
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
const ids = JSON.parse(fs.readFileSync(idsPath, 'utf8'))
const boxId = 'astonishing_volt_tackle'
const official = 'https://www.pokemon-card.com/ex/s4/index.html'
if (!data.boxes.some(b => b.box_id === boxId)) data.boxes.push({
  box_id: boxId, box_name: '仰天のボルテッカー', code: 'S4', release_ym: '2020-09',
  certainty: 'released', pack_price_yen: 165, packs_per_box: 30,
  pack_image_url: 'https://cdn.snkrdunk.com/upload_bg_removed/20240517020811-0.webp?size=l',
  note: `2020年9月18日発売。1パック5枚入り、1BOX30パック。公式商品情報：${official}`,
})
ids[`box-${boxId}-shrink`] = 12879
const cards = [
  [114, 'ピカチュウVMAX', 'HR', 91197, '20230727022700-0.webp', '雷', 'VMAX', 310],
  [104, 'ピカチュウV', 'SR', 101654, '20221027042256-1.webp', '雷', '基本', 190],
  [111, 'ルリナ', 'SR', 91196, '20230510033334-0.webp', 'サポート', 'トレーナーズ', 0],
  [109, 'サイトウ', 'SR', 91195, '20230727022748-0.webp', 'サポート', 'トレーナーズ', 0],
  [110, 'ダンデ', 'SR', 101670, '20221027042647-0.webp', 'サポート', 'トレーナーズ', 0],
]
for (const [no, name, rarity, snkrId, image, type, stage, hp] of cards) {
  const id = `astonishing-volt-tackle-${no}`
  if (!data.cards.some(c => c.id === id)) data.cards.push({
    id, card_no: `${no}/100`, rarity, card_name: name, box_id: boxId, is_reprint: false,
    image_url: `https://cdn.snkrdunk.com/upload_bg_removed/${image}?size=l`,
    card_spec: { type, stage, hp, note: `仰天のボルテッカー収録・${rarity}。` },
    materials: {
      player: { regulation_mark: 'D', rotation: 'unknown', competitive_usage: 'none' },
      collector: { illustrator: '未確認', illustrator_popularity: 'unknown', artwork_type: 'original', rarity },
      common: { reprint_status: 'none', scarcity: 'normal', character_popularity: 'unknown' },
    },
    evidence_notes: { player: 'ソード＆シールド期・レギュレーションマークD。',
      collector: `S4 ${no}/100・${rarity}。`, source: `https://snkrdunk.com/apparels/${snkrId}` },
    note: `仰天のボルテッカーの主要収録カード。商品情報：${official}`,
  })
  ids[id] = snkrId
}
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n')
fs.writeFileSync(idsPath, JSON.stringify(ids, null, 2) + '\n')
console.log('仰天のボルテッカーBOX・主要カード5枚を登録しました')
