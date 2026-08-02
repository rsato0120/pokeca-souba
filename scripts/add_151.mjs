// ポケモンカード151(sv2a)の高額チェイス15枚を pokeca_data.json に追加（未追跡運用）
// 範囲: AR目玉3(169/173/183) + リザードンex SR(185) + SAR8(200-207) + UR3(208-210)
// 画像: limitless SV2a_{番号}_R_JP_LG.png（pokeca.netはsv2a無し・全番号200確認済み）
import fs from 'fs'
import path from 'path'

const file = path.join(process.cwd(), 'data', 'pokeca_data.json')
const data = JSON.parse(fs.readFileSync(file, 'utf-8'))

const BOX_ID = 'pokemon_151'

// --- box 定義 ---
const box = {
  box_id: BOX_ID,
  box_name: 'ポケモンカード151',
  code: 'SV2a',
  release_ym: '2023-06',
  certainty: 'released',
  pack_price_yen: 290,
  packs_per_box: 20,
  pack_image_url: 'https://archives.bulbagarden.net/media/upload/1/15/SV2a_F_pack.png',
  note: '2023-06-16発売の強化拡張パック。初代カントー151匹をポケモン図鑑順に収録。受注生産で大量再販されたが、リザードンex SAR・ミュウex UR/SARを筆頭にチェイスは高値安定。',
}

function imageUrl(num) {
  return `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SV2a/SV2a_${num}_R_JP_LG.png`
}

function makeCard({ id, num, rarity, name, type, stage, hp, popularity, competitive = 'none', scarcity = 'normal' }) {
  return {
    id,
    card_no: `${num}/165`,
    rarity,
    card_name: name,
    box_id: BOX_ID,
    is_reprint: false,
    image_url: imageUrl(num),
    card_spec: { type, stage, hp, note: '' },
    materials: {
      player: { regulation_mark: 'F', rotation: 'far', competitive_usage: competitive },
      collector: { illustrator: 'unknown', illustrator_popularity: 'unknown', artwork_type: 'original', rarity },
      common: { reprint_status: 'reprinted', scarcity, character_popularity: popularity },
    },
    evidence_notes: { player: '', collector: '', source: '' },
    note: '',
  }
}

const cards = [
  // --- AR 目玉3枚 ---
  makeCard({ id: 'pokemon-151-rizaado-ar-169',      num: 169, rarity: 'AR', name: 'リザード',     type: '炎', stage: '1進化ポケモン', hp: 90,  popularity: 'high' }),
  makeCard({ id: 'pokemon-151-pikachu-ar-173',      num: 173, rarity: 'AR', name: 'ピカチュウ',   type: '雷', stage: 'たねポケモン',  hp: 60,  popularity: 'high' }),
  makeCard({ id: 'pokemon-151-myuutsuu-ar-183',     num: 183, rarity: 'AR', name: 'ミュウツー',   type: '超', stage: 'たねポケモン',  hp: 130, popularity: 'high' }),

  // --- リザードンex SR ---
  makeCard({ id: 'pokemon-151-rizaadon-ex-sr-185',  num: 185, rarity: 'SR', name: 'リザードンex', type: '炎', stage: 'ポケモンex', hp: 330, popularity: 'high', competitive: 'mid' }),

  // --- SAR 8枚 (200-207) ---
  makeCard({ id: 'pokemon-151-fushigibana-ex-sar-200', num: 200, rarity: 'SAR', name: 'フシギバナex',   type: '草', stage: 'ポケモンex', hp: 300, popularity: 'high' }),
  makeCard({ id: 'pokemon-151-rizaadon-ex-sar-201',    num: 201, rarity: 'SAR', name: 'リザードンex',   type: '炎', stage: 'ポケモンex', hp: 330, popularity: 'high', competitive: 'mid' }),
  makeCard({ id: 'pokemon-151-kamekkusu-ex-sar-202',   num: 202, rarity: 'SAR', name: 'カメックスex',   type: '水', stage: 'ポケモンex', hp: 310, popularity: 'high' }),
  makeCard({ id: 'pokemon-151-fuudin-ex-sar-203',      num: 203, rarity: 'SAR', name: 'フーディンex',   type: '超', stage: 'ポケモンex', hp: 190, popularity: 'mid' }),
  makeCard({ id: 'pokemon-151-sandaa-ex-sar-204',      num: 204, rarity: 'SAR', name: 'サンダーex',     type: '雷', stage: 'たねポケモンex', hp: 200, popularity: 'mid' }),
  makeCard({ id: 'pokemon-151-myuu-ex-sar-205',        num: 205, rarity: 'SAR', name: 'ミュウex',       type: '超', stage: 'たねポケモンex', hp: 180, popularity: 'high', competitive: 'mid' }),
  makeCard({ id: 'pokemon-151-erika-no-shoutai-sar-206',  num: 206, rarity: 'SAR', name: 'エリカの招待',   type: 'サポート', stage: 'トレーナーズ', hp: 0, popularity: 'high', competitive: 'mid' }),
  makeCard({ id: 'pokemon-151-sakaki-no-karisuma-sar-207', num: 207, rarity: 'SAR', name: 'サカキのカリスマ', type: 'サポート', stage: 'トレーナーズ', hp: 0, popularity: 'mid' }),

  // --- UR 3枚 (208-210) ---
  makeCard({ id: 'pokemon-151-myuu-ex-ur-208',         num: 208, rarity: 'UR', name: 'ミュウex',           type: '超', stage: 'たねポケモンex', hp: 180, popularity: 'high', competitive: 'mid' }),
  makeCard({ id: 'pokemon-151-pokemon-irekae-ur-209',  num: 209, rarity: 'UR', name: 'ポケモンいれかえ',   type: 'グッズ',   stage: 'トレーナーズ', hp: 0, popularity: 'mid', competitive: 'high' }),
  makeCard({ id: 'pokemon-151-kihon-chou-energy-ur-210', num: 210, rarity: 'UR', name: '基本超エネルギー', type: 'エネルギー', stage: 'エネルギー', hp: 0, popularity: 'mid' }),
]

// --- 投入(冪等: 既存のpokemon_151を除去してから追加) ---
data.boxes = data.boxes.filter(b => b.box_id !== BOX_ID)
data.boxes.push(box)
data.cards = data.cards.filter(c => c.box_id !== BOX_ID)
data.cards.push(...cards)

fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')

console.log(`追加完了: box=${BOX_ID}, cards=${cards.length}枚`)
const byR = {}
for (const c of cards) byR[c.rarity] = (byR[c.rarity] || 0) + 1
console.log('レアリティ内訳:', JSON.stringify(byR))
console.log('全カード数:', data.cards.length)
