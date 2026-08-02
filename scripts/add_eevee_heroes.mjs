// イーブイヒーローズ(S6a)の光物28枚を pokeca_data.json に追加する生成スクリプト（未追跡運用）
// 画像: 070-087=limitless / 088-097=TCGplayer CDN（limitlessは#87までしか無いため）
import fs from 'fs'
import path from 'path'

const file = path.join(process.cwd(), 'data', 'pokeca_data.json')
const data = JSON.parse(fs.readFileSync(file, 'utf-8'))

const BOX_ID = 'eevee_heroes'

// --- box 定義 ---
const box = {
  box_id: BOX_ID,
  box_name: 'イーブイヒーローズ',
  code: 'S6a',
  release_ym: '2021-05',
  certainty: 'released',
  pack_price_yen: 165,
  packs_per_box: 30,
  pack_image_url: 'https://archives.bulbagarden.net/media/upload/0/03/S6a_Eevee_Heroes_pack.jpg',
  note: '2021-05-28発売の強化拡張パック。イーブイズ(進化系8体)のV/VMAXを描き下ろしSAで大量収録。絶版で長期にわたり高騰。目玉はブラッキーVMAX SA・ニンフィアVMAX SA。',
}

// --- イーブイズ定義 ---
const eevees = {
  riifia:   { jp: 'リーフィア', type: '草' },
  buusutaa: { jp: 'ブースター', type: '炎' },
  shawaazu: { jp: 'シャワーズ', type: '水' },
  gureishia:{ jp: 'グレイシア', type: '水' },
  sandaasu: { jp: 'サンダース', type: '雷' },
  eefi:     { jp: 'エーフィ',   type: '超' },
  ninfia:   { jp: 'ニンフィア', type: 'フェアリー' },
  burakkii: { jp: 'ブラッキー', type: '悪' },
}

// num 順の V(フルアート=SR偶数 / 特別アート=SA奇数)
const vPairs = [
  ['riifia', 70], ['buusutaa', 72], ['shawaazu', 74], ['gureishia', 76],
  ['sandaasu', 78], ['eefi', 80], ['ninfia', 82], ['burakkii', 84],
]
// VMAXは4体のみ(レインボーHR偶数 / 特別アートSA奇数)
const vmaxPairs = [
  ['riifia', 88], ['gureishia', 90], ['ninfia', 92], ['burakkii', 94],
]

function imageUrl(num) {
  if (num <= 87) {
    return `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/S6a/S6a_${num}_R_JP_LG.png`
  }
  return `https://tcgplayer-cdn.tcgplayer.com/product/${570462 + num}_in_1000x1000.jpg`
}

function makeCard({ id, num, rarity, name, type, stage, hp, popularity }) {
  return {
    id,
    card_no: `${String(num).padStart(3, '0')}/069`,
    rarity,
    card_name: name,
    box_id: BOX_ID,
    is_reprint: false,
    image_url: imageUrl(num),
    card_spec: { type, stage, hp, note: '' },
    materials: {
      player: { regulation_mark: 'E', rotation: 'unknown', competitive_usage: 'none' },
      collector: { illustrator: 'unknown', illustrator_popularity: 'unknown', artwork_type: 'original', rarity },
      common: { reprint_status: 'none', scarcity: 'out_of_print', character_popularity: popularity },
    },
    evidence_notes: { player: '', collector: '', source: '' },
    note: '',
  }
}

const cards = []

// V: フルアート(SR) + 特別アート(SA)
for (const [romaji, baseNum] of vPairs) {
  const e = eevees[romaji]
  cards.push(makeCard({ id: `eevee-heroes-${romaji}-v-sr-${baseNum}`,     num: baseNum,     rarity: 'SR', name: `${e.jp}V`, type: e.type, stage: 'ポケモンV', hp: 210, popularity: 'high' }))
  cards.push(makeCard({ id: `eevee-heroes-${romaji}-v-sa-${baseNum + 1}`, num: baseNum + 1, rarity: 'SA', name: `${e.jp}V`, type: e.type, stage: 'ポケモンV', hp: 210, popularity: 'high' }))
}

// サポートSR
cards.push(makeCard({ id: 'eevee-heroes-aroma-na-oneesan-sr-86', num: 86, rarity: 'SR', name: 'アロマなおねえさん', type: 'サポート', stage: 'トレーナーズ', hp: 0, popularity: 'mid' }))
cards.push(makeCard({ id: 'eevee-heroes-makuwa-sr-87',           num: 87, rarity: 'SR', name: 'マクワ',           type: 'サポート', stage: 'トレーナーズ', hp: 0, popularity: 'mid' }))

// VMAX: レインボー(HR) + 特別アート(SA)
// リーフィア088/グレイシア090のHRはスニダン素体取引が少なくメルカリ検索もHR:SAに誤マッチして
// 価格が安定取得できないため一旦除外（SAは取得可なので維持）。価格が取れ次第追加する。
const EXCLUDE_HR = new Set([88, 90])
for (const [romaji, baseNum] of vmaxPairs) {
  const e = eevees[romaji]
  if (!EXCLUDE_HR.has(baseNum)) {
    cards.push(makeCard({ id: `eevee-heroes-${romaji}-vmax-hr-${baseNum}`, num: baseNum, rarity: 'HR', name: `${e.jp}VMAX`, type: e.type, stage: 'ポケモンVMAX', hp: 320, popularity: 'high' }))
  }
  cards.push(makeCard({ id: `eevee-heroes-${romaji}-vmax-sa-${baseNum + 1}`, num: baseNum + 1, rarity: 'SA', name: `${e.jp}VMAX`, type: e.type, stage: 'ポケモンVMAX', hp: 320, popularity: 'high' }))
}

// サポート金(HR)
cards.push(makeCard({ id: 'eevee-heroes-aroma-na-oneesan-hr-96', num: 96, rarity: 'HR', name: 'アロマなおねえさん', type: 'サポート', stage: 'トレーナーズ', hp: 0, popularity: 'mid' }))
cards.push(makeCard({ id: 'eevee-heroes-makuwa-hr-97',           num: 97, rarity: 'HR', name: 'マクワ',           type: 'サポート', stage: 'トレーナーズ', hp: 0, popularity: 'mid' }))

// --- 投入(冪等: 既存のeevee_heroesを除去してから追加) ---
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
