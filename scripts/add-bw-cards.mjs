import fs from 'node:fs'

// スニダンの商品名・型番・商品画像を2026-10-09に照合。価格は成約取得でのみ登録する。
const catalogPath = 'data/pokeca_data.json'
const idsPath = 'data/snkrdunk-ids.json'
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
const ids = JSON.parse(fs.readFileSync(idsPath, 'utf8'))
const sets = [
  ['bw_black_collection', 'ブラックコレクション', 'BW1-B', '2010-12-17'],
  ['bw_white_collection', 'ホワイトコレクション', 'BW1-W', '2010-12-17'],
  ['bw_dragon_blast', 'リューズブラスト', 'BW5-G', '2012-03-16'],
  ['bw_plasma_gale', 'プラズマゲイル', 'BW7', '2012-09-14'],
]
for (const [box_id, box_name, code, release_date] of sets) {
  if (catalog.boxes.some(box => box.box_id === box_id)) continue
  catalog.boxes.push({ box_id, box_name, code, release_ym: release_date.slice(0, 7), release_date,
    certainty: 'released', pack_price_yen: 158,
    note: 'BW期の収録カードを追跡。未開封BOXの価格・開封期待値は未対応。価格はスニダンの商品区分に基づき、1ED表記の商品は別商品として扱う。' })
}
const rows = [
  ['bw-black-reshiram-sr-55', 'bw_black_collection', 'レシラム', '055/053', 'SR', '炎', 'たね', 130, 91641, '0c990500-01f6-4f1b-aa70-3f3205e01263'],
  ['bw-white-zekrom-sr-55', 'bw_white_collection', 'ゼクロム', '055/053', 'SR', '雷', 'たね', 130, 91640, '8667a0f6-804d-4b19-b3f5-7ac330343435'],
  ['bw-dragon-blast-mew-ex-sr-51', 'bw_dragon_blast', 'ミュウEX', '051/050', 'SR', '超', 'たね', 120, 91620, 'd724d463-b866-4591-9d93-0c03c74e442f'],
  ['bw-plasma-gale-skyla-sr-76', 'bw_plasma_gale', 'フウロ', '076/070', 'SR', 'サポート', 'サポート', 0, 91599, '23f73b13-88e9-4620-a4a8-4a8465d42d4b'],
  ['bw-plasma-gale-charizard-ur-77', 'bw_plasma_gale', 'リザードン', '077/070', 'UR', '炎', '2進化', 160, 406359, '9e55a779-5103-4778-8c4d-c62fb2565988'],
]
for (const [id, box_id, card_name, card_no, rarity, type, stage, hp, productId, image] of rows) {
  if (!catalog.cards.some(card => card.id === id)) catalog.cards.push({
    id, box_id, card_name, card_no, rarity, is_reprint: false,
    image_url: `https://cdn.snkrdunk.com/upload_bg_removed/${image}.webp?size=l`,
    card_spec: { type, stage, hp, note: 'BW期のオリジナル収録版。復刻版と別に追跡。' },
    materials: {
      player: { regulation_mark: 'unknown', rotation: 'unknown', competitive_usage: 'none' },
      collector: { illustrator: 'unknown', illustrator_popularity: 'unknown', artwork_type: 'original', rarity },
      common: { reprint_status: 'none', scarcity: 'out_of_print', character_popularity: 'high' },
    },
    evidence_notes: { player: '現行スタンダード対象外のBW期カード。',
      collector: `${card_name}のBW期${rarity}版。素体は傷などの状態による価格差があります。`,
      source: `2026-10-09 商品名・型番・画像照合: https://snkrdunk.com/apparels/${productId}` },
    note: 'スニダンの1ED表記なしの商品区分。1ED版と復刻版は集計しない。素体とPSA10は別に追跡。',
  })
  ids[id] = productId
}
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n')
fs.writeFileSync(idsPath, JSON.stringify(ids, null, 2) + '\n')
console.log('BW期4弾・主要カード5枚を登録（価格は成約取得後に表示）')
