// One-time, idempotent import for the 30th CELEBRATION Premium Deck Set.
// Only the four special-art cards with dedicated SNKRDUNK market pages are added.
import fs from 'node:fs'

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const save = (file, data) => fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)

const box = {
  box_id: '30th_premium_deck_set',
  box_name: '30th CELEBRATION プレミアムデッキセット エーフィ・ブラッキー',
  code: 'MF',
  release_ym: '2026-09',
  release_date: '2026-09-16',
  certainty: 'released',
  pack_price_yen: 6200,
  msrp_yen: 6200,
  pack_image_url: 'https://cdn.snkrdunk.com/upload_bg_removed/f08973d8-723a-400b-8371-800d5913779f.webp?size=l',
  note: '2026年9月16日発売。エーフィexデッキ・ブラッキーexデッキ各60枚と特別仕様カードを収録。希望小売価格6,200円。スニダン商品ID 881423。',
}

const rows = [
  ['041', 'AR仕様', 'ビクティニ', '炎', 892710, 'https://cdn.snkrdunk.com/upload_bg_removed/c73941fd-c44d-48ed-bd89-3cae4c9a75a9.webp?size=l'],
  ['043', 'SAR仕様', 'エーフィex', '超', 881430, 'https://cdn.snkrdunk.com/upload_bg_removed/73acd0cb-07fc-499e-b2e2-59e10c8e26e2.webp?size=l'],
  ['044', 'SAR仕様', 'ブラッキーex', '悪', 881431, 'https://cdn.snkrdunk.com/upload_bg_removed/f078d5c7-085f-4e12-bfc0-144b3e61cb9d.webp?size=l'],
]

const cards = rows.map(([no, rarity, name, type, apparelId, imageUrl]) => ({
  id: `30th-premium-deck-${no}`,
  card_no: `${no}/040`,
  rarity,
  card_name: name,
  box_id: box.box_id,
  is_reprint: false,
  image_url: imageUrl,
  card_spec: {
    type,
    stage: name.endsWith('ex') ? '1進化' : 'たね',
    hp: 0,
    note: `30周年プレミアムデッキセット収録の${rarity}カード。`,
  },
  materials: {
    player: { regulation_mark: '不明', rotation: 'unknown', competitive_usage: 'none' },
    collector: { illustrator: '不明', illustrator_popularity: 'unknown', artwork_type: 'original', rarity },
    common: { reprint_status: 'none', scarcity: 'normal', character_popularity: name.includes('ブラッキー') || name.includes('エーフィ') ? 'high' : 'mid' },
  },
  evidence_notes: {
    player: '構築済みデッキ収録カード。',
    collector: `30周年記念商品の${rarity}。`,
    source: `https://snkrdunk.com/apparels/${apparelId}`,
  },
  note: `スニダン公開商品ID ${apparelId}から取得。`,
}))

const data = read('data/pokeca_data.json')
const celebration = data.boxes.find(item => item.box_id === '30th_celebration')
if (celebration) celebration.certainty = 'released'
data.boxes = [box, ...data.boxes.filter(item => item.box_id !== box.box_id)]
data.cards = [...cards, ...data.cards.filter(card => card.box_id !== box.box_id)]
save('data/pokeca_data.json', data)

const snkrdunkIds = read('data/snkrdunk-ids.json')
snkrdunkIds[`box-${box.box_id}`] = 881423
for (const id of Object.keys(snkrdunkIds)) {
  if (id.startsWith('30th-premium-deck-')) delete snkrdunkIds[id]
}
for (const [index, card] of cards.entries()) snkrdunkIds[card.id] = rows[index][4]
save('data/snkrdunk-ids.json', snkrdunkIds)

console.log(`Imported ${box.box_name} and ${cards.length} priceable special-art cards.`)
