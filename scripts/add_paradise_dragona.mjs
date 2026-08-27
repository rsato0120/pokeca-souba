// 強化拡張パック 楽園ドラゴーナ（SV7a・2024-09-13発売）の高額チェイス10枚を追加する。
// カード名/番号/HP/タイプ/ステージ/イラストレーターは limitlesstcg.com/cards/jp/SV7a/{番号} で1枚ずつ確認（2026-08-27）。
// 選定基準＝遊々亭の販売一覧（https://yuyu-tei.jp/sell/poc/s/sv07a）の高額帯。
// SR 083-085（¥420〜500）と UR 093/094（¥680）は薄商いで欠測しやすいため見送り。
// ⚠️ 画像URLは **先頭ゼロなし**（SV7a_87_R_JP_LG.png）。
import fs from 'node:fs'

const DATA = 'C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json'
const BOX = 'paradise_dragona'
const PREFIX = 'paradise-dragona'
const TOTAL = '064'
const img = (n) => `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SV7a/SV7a_${Number(n)}_R_JP_LG.png`

const BOX_ENTRY = {
  box_id: BOX,
  box_name: '楽園ドラゴーナ',
  code: 'SV7a',
  release_ym: '2024-09',
  certainty: 'released',
  pack_price_yen: 180,
  packs_per_box: 30,
  pack_image_url: 'https://s3.limitlesstcg.com/sets/jp/SV7a.png',
  note: '2024-09-13発売の強化拡張パック（1パック5枚・1BOX30パック）。ドラゴンタイプを軸に構成された弾。シークレット枠は AR 065-076 / SR 077-086 / SAR 087-091 / UR 092-094。ラティアスex SAR(087)とルチアのアピール SAR(091)が並んで最高額で、2枚だけが突出した二強構成。本サイトは相場が動く高額帯10枚を掲載。',
}

// [番号, レアリティ, カード名, slug, タイプ, ステージ, HP, イラストレーター, 絵師人気, キャラ人気, 品薄度, 競技採用, spec備考, collector備考]
const ROWS = [
  // ── AR ───────────────────────────────────────────────────────
  ['70', 'AR', 'ラティオス', 'latios', '超', 'たね', 120, 'OKACHEKE', 'high', 'high', 'normal', 'none',
    'たねの超ポケモン。HP120。',
    'OKACHEKE によるラティオスAR。同じ絵師のラティアスex SAR(087)と対になる構図で、セット需要がある。この弾のAR帯で最高額。'],

  // ── SR ───────────────────────────────────────────────────────
  ['77', 'SR', 'ブラックキュレムex', 'black-kyurem-ex', '水', 'たね', 230, 'N-DESIGN Inc.', 'mid', 'mid', 'normal', 'mid',
    'たねの水ポケモンex。HP230。',
    'N-DESIGN Inc. による通常イラストSR。キュレムのフォルムチェンジは一定の人気があるが、SR帯では中位。'],
  ['78', 'SR', 'ラティアスex', 'latias-ex', '超', 'たね', 210, 'takuyoa', 'mid', 'high', 'normal', 'high',
    'たねの超ポケモンex。特性で自分のたねポケモン全員の逃げるエネルギーが0になる。',
    'takuyoa による通常イラストSR。SAR(087)が突出しているためその受け皿になっており、SR帯ではルチアのアピールに次ぐ。'],
  ['86', 'SR', 'ルチアのアピール', 'lucias-appeal', 'サポート', 'サポート', 0, 'En Morikura', 'high', 'high', 'normal', 'mid',
    'サポート。相手のベンチのたねポケモン1匹をバトル場と入れ替え、こんらんにする。',
    'En Morikura による通常イラストSR。ルチアはシンオウのコンテストアイドルで女性トレーナー人気が高く、SR帯トップ。'],

  // ── SAR ──────────────────────────────────────────────────────
  ['87', 'SAR', 'ラティアスex', 'latias-ex', '超', 'たね', 210, 'OKACHEKE', 'high', 'high', 'scarce', 'high',
    '特性「スカイエスコート」=自分のたねポケモン全員の逃げエネが0／ワザ「インフィニットブレード」200ダメージ（次の番ワザが使えない）。',
    'OKACHEKE による描き下ろしSAR。ラティアスは初代映画以来の根強い人気があり、構築での実需とも重なってこの弾の最高額（ルチアのアピールSARと同水準）。'],
  ['88', 'SAR', 'ブリジュラスex', 'archaludon-ex', '鋼', '1進化', 300, 'Shinya Mizuno', 'mid', 'mid', 'normal', 'high',
    '1進化の鋼ポケモンex。特性「ごうきんビルド」=進化時にトラッシュから基本鋼エネを2枚まで加速／ワザ「メタルディフェンダー」220。',
    'Shinya Mizuno による描き下ろしSAR。構築での実需は強かったが、キャラ人気が中位でSAR帯では下位寄り。'],
  ['89', 'SAR', 'アローラ ナッシーex', 'alolan-exeggutor-ex', '竜', '1進化', 300, 'Yuriko Akase', 'mid', 'high', 'normal', 'mid',
    '1進化の竜ポケモンex。HP300。ワザ「トロピカルフィーバー」でエネ加速、「ブンブンスフェーン」はコインで相手のたねポケモンをきぜつさせる。',
    'Yuriko Akase による描き下ろしSAR。アローラナッシーはネタ的な人気が高くこの弾の看板ポケモン。SAR帯では二強に次ぐ3番手。'],
  ['90', 'SAR', 'カキツバタ', 'amarys', 'サポート', 'サポート', 0, 'DOM', 'mid', 'mid', 'normal', 'mid',
    'サポート。山札の上から7枚を見て、ポケモン1枚とトレーナーズ1枚を手札に加える。',
    'DOM によるカキツバタSAR。ブルーベリー学園の四天王で鋼タイプ使い。女性トレーナーSARだがルチアほどのキャラ人気は無く、SAR帯では下位。'],
  ['91', 'SAR', 'ルチアのアピール', 'lucias-appeal', 'サポート', 'サポート', 0, 'Nobusawa/Mochipuyo', 'high', 'high', 'scarce', 'mid',
    'サポート。相手のベンチのたねポケモン1匹をバトル場と入れ替え、こんらんにする。',
    'Nobusawa/Mochipuyo によるルチアSAR。女性トレーナーSARの中でも人気が高く、ラティアスex SARと並ぶこの弾の最高額。'],

  // ── UR ───────────────────────────────────────────────────────
  ['92', 'UR', 'アローラ ナッシーex', 'alolan-exeggutor-ex', '竜', '1進化', 300, 'aky CG Works', 'mid', 'high', 'normal', 'mid',
    'SAR(089)と同スペックの金加工版。',
    'aky CG Works によるUR。この弾のURで最も高い。アローラナッシーの人気がそのままUR相場に出ている。'],
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
      source: 'limitlesstcg.com/cards/jp/SV7a/{番号} で名称・番号・HP・タイプ・ステージ・イラストレーターを1枚ずつ確認（2026-08-27）',
    },
    note: '',
  })
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`${BOX}: ${before} -> ${ROWS.length} 枚（合計 ${data.cards.length} 枚 / ${data.boxes.length} box）`)
const ids = data.cards.map((c) => c.id)
const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
console.log(dup.length ? `⚠️ 重複ID: ${dup.join(', ')}` : 'ID重複なし')
