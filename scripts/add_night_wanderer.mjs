// 強化拡張パック ナイトワンダラー（SV6a・2024-06-07発売）の高額チェイス10枚を追加する。
// カード名/番号/HP/タイプ/ステージ/イラストレーターは limitlesstcg.com/cards/jp/SV6a/{番号} で1枚ずつ確認（2026-08-27）。
// 選定基準＝遊々亭の販売一覧（https://yuyu-tei.jp/sell/poc/s/sv06a）の高額帯。
// ⚠️ この弾は4弾の中で最も相場が低く、最高額のキチキギスex SAR でも販売¥3,480。
//    SR 077-080/084-086（¥420〜680）と AR 065-076 は薄商いで欠測しやすいため全て見送り。
// ⚠️ 画像URLは **先頭ゼロなし**（SV6a_90_R_JP_LG.png）。
import fs from 'node:fs'

const DATA = 'C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json'
const BOX = 'night_wanderer'
const PREFIX = 'night-wanderer'
const TOTAL = '064'
const img = (n) => `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SV6a/SV6a_${Number(n)}_R_JP_LG.png`

const BOX_ENTRY = {
  box_id: BOX,
  box_name: 'ナイトワンダラー',
  code: 'SV6a',
  release_ym: '2024-06',
  certainty: 'released',
  pack_price_yen: 180,
  packs_per_box: 30,
  pack_image_url: 'https://s3.limitlesstcg.com/sets/jp/SV6a.png',
  note: '2024-06-07発売の強化拡張パック（1パック5枚・1BOX30パック）。DLC「藍の円盤」のお面ポケモンとモモワロウを軸にした悪タイプ中心の弾。シークレット枠は AR 065-076 / SR 077-086 / SAR 087-091 / UR 092-094。SAR5種のうち4種を kantaro が担当。相場は4弾中で最も低く、キチキギスex SAR(089)が最高額。本サイトは相場が動く高額帯10枚を掲載。',
}

// [番号, レアリティ, カード名, slug, タイプ, ステージ, HP, イラストレーター, 絵師人気, キャラ人気, 品薄度, 競技採用, spec備考, collector備考]
const ROWS = [
  // ── SR ───────────────────────────────────────────────────────
  ['81', 'SR', 'キチキギスex', 'fezandipiti-ex', '悪', 'たね', 210, '5ban Graphics', 'mid', 'mid', 'normal', 'high',
    'たねの悪ポケモンex。特性で前の番に自分のポケモンがきぜつしていれば3枚引ける。',
    '5ban Graphics による通常イラストSR。ドロー特性で構築採用が非常に長く続いたカードで、プレイヤー需要によりこの弾のSR帯トップ。'],
  ['83', 'SR', 'アクロマの執念', 'colress-tenacity', 'サポート', 'サポート', 0, 'hncl', 'mid', 'mid', 'normal', 'high',
    'サポート。山札からスタジアム1枚とエネルギー1枚を手札に加える。',
    'hncl による通常イラストSR。スタジアムとエネを同時に持ってくる実用サポートで、SR帯ではキチキギスexに次ぐ。'],

  // ── SAR ──────────────────────────────────────────────────────
  ['87', 'SAR', 'イイネイヌex', 'okidogi-ex', '悪', 'たね', 250, 'kantaro', 'mid', 'mid', 'normal', 'low',
    'たねの悪ポケモンex。お面ポケモンの1体。',
    'kantaro による描き下ろしSAR。お面ポケモン3種のうちHPが最も高いが、キャラ人気は成熟しておらずSAR帯では下位。'],
  ['88', 'SAR', 'マシマシラex', 'munkidori-ex', '悪', 'たね', 210, 'kantaro', 'mid', 'mid', 'normal', 'mid',
    'たねの悪ポケモンex。お面ポケモンの1体。',
    'kantaro による描き下ろしSAR。ダメカン操作で構築採用があったが、キャラ人気が弱くSAR帯では最下位。'],
  ['89', 'SAR', 'キチキギスex', 'fezandipiti-ex', '悪', 'たね', 210, 'kantaro', 'mid', 'mid', 'normal', 'high',
    'SR(081)と同スペックの特別イラスト版。特性でドローできる。',
    'kantaro による描き下ろしSAR。長期にわたる構築需要とSAR人気が重なり、この弾の最高額。'],
  ['90', 'SAR', 'モモワロウex', 'pecharunt-ex', '悪', 'たね', 190, 'kantaro', 'mid', 'mid', 'normal', 'high',
    'たねの悪ポケモンex。特性で悪ポケモンをベンチに出しどく状態にする。ワザは相手が取ったサイド枚数×60ダメージ。',
    'kantaro による描き下ろしSAR。「藍の円盤」の幻ポケモンで、構築でも長く使われた。SAR帯ではキチキギスexに次ぐ。'],
  ['91', 'SAR', 'カシオペア', 'cassiopeia', 'サポート', 'サポート', 0, 'burari', 'high', 'high', 'normal', 'mid',
    'サポート。手札がこのカード1枚だけの時に使える。山札から2枚まで選んで手札に加える。',
    'burari によるカシオペアSAR。ブルーベリー学園の正体を隠した人物で、女性トレーナーSARとしてモモワロウexと同水準の相場。'],

  // ── UR ───────────────────────────────────────────────────────
  ['92', 'UR', 'モモワロウex', 'pecharunt-ex', '悪', 'たね', 190, 'aky CG Works', 'mid', 'mid', 'normal', 'high',
    'SAR(090)と同スペックの金加工版。',
    'aky CG Works によるUR。幻ポケモンのURとして、構築需要とコレクター需要の両方がある。'],
  ['93', 'UR', '大地の器', 'earthen-vessel', 'グッズ', 'グッズ', 0, 'AYUMI ODASHIMA', 'mid', 'low', 'normal', 'high',
    'グッズ。手札を1枚トラッシュし、山札から基本エネルギーを2枚まで手札に加える。',
    'エネ加速の定番グッズ。実用URとして構築需要で値持ちするが、この弾のURでは最も安い。'],
  ['94', 'UR', '力の砂時計', 'hourglass-of-power', 'ポケモンのどうぐ', 'ポケモンのどうぐ', 0, 'Studio Bora Inc.', 'mid', 'low', 'normal', 'high',
    'ポケモンのどうぐ。自分の番の終わりに、ついているポケモンがバトル場にいるなら、トラッシュから基本エネを1枚つけられる。',
    'この弾のURで最も高い。エネ回収のどうぐとして構築採用が続き、プレイヤー需要で支えられている実用UR。'],
]

const data = JSON.parse(fs.readFileSync(DATA, 'utf-8'))

const bi = data.boxes.findIndex((b) => b.box_id === BOX)
if (bi >= 0) data.boxes[bi] = BOX_ENTRY
else data.boxes.push(BOX_ENTRY)

const before = data.cards.filter((c) => c.box_id === BOX).length
data.cards = data.cards.filter((c) => c.box_id !== BOX)

for (const [no, rarity, name, slug, type, stage, hp, illus, illusPop, charPop, scarcity, usage, specNote, colNote] of ROWS) {
  data.cards.push({
    id: `${PREFIX}-${slug}-${rarity.toLowerCase()}-${Number(no)}`,
    card_no: `${no}/${TOTAL}`,
    rarity,
    card_name: name,
    box_id: BOX,
    is_reprint: false,
    image_url: img(no),
    card_spec: { type, stage, hp, note: specNote },
    materials: {
      player: { regulation_mark: 'G', rotation: 'far', competitive_usage: usage },
      collector: { illustrator: illus, illustrator_popularity: illusPop, artwork_type: 'original', rarity },
      common: { reprint_status: 'none', scarcity, character_popularity: charPop },
    },
    evidence_notes: {
      player: '',
      collector: colNote,
      source: 'limitlesstcg.com/cards/jp/SV6a/{番号} で名称・番号・HP・タイプ・ステージ・イラストレーターを1枚ずつ確認（2026-08-27）',
    },
    note: '',
  })
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`${BOX}: ${before} -> ${ROWS.length} 枚（合計 ${data.cards.length} 枚 / ${data.boxes.length} box）`)
const ids = data.cards.map((c) => c.id)
const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
console.log(dup.length ? `⚠️ 重複ID: ${dup.join(', ')}` : 'ID重複なし')
