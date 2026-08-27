// 強化拡張パック クリムゾンヘイズ（SV5a・2024-03-22発売）の高額チェイス13枚を追加する。
// カード名/番号/HP/タイプ/ステージ/イラストレーターは limitlesstcg.com/cards/jp/SV5a/{番号} で1枚ずつ確認（2026-08-27）。
// 選定基準＝遊々亭の販売一覧（https://yuyu-tei.jp/sell/poc/s/sv05a）の高額帯。
// SR の 079/080/084/085/086（販売¥420〜500）と AR 067（¥680）は薄商いでメルカリ成約が
// 取れず欠測になりやすいため見送り。UR 094/096 も同様。
// ⚠️ 画像URLは **先頭ゼロなし**（SV5a_90_R_JP_LG.png）。ゼロ埋めすると全て403になる。
import fs from 'node:fs'

const DATA = 'C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json'
const BOX = 'crimson_haze'
const PREFIX = 'crimson-haze'
const TOTAL = '066'
const img = (n) => `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SV5a/SV5a_${Number(n)}_R_JP_LG.png`

const BOX_ENTRY = {
  box_id: BOX,
  box_name: 'クリムゾンヘイズ',
  code: 'SV5a',
  release_ym: '2024-03',
  certainty: 'released',
  pack_price_yen: 180,
  packs_per_box: 30,
  pack_image_url: 'https://s3.limitlesstcg.com/sets/jp/SV5a.png',
  note: '2024-03-22発売の強化拡張パック（1パック5枚・1BOX30パック）。DLC「碧の円盤」のキタカミ／ブルーベリー学園のポケモンを収録。シークレット枠は AR 067-078 / SR 079-088 / SAR 089-093 / UR 094-096。ゲッコウガex SAR(090)が突出した最高額で、サザレ・スイレンのお世話の女性トレーナーSARが続く。本サイトは相場が動く高額帯13枚を掲載。',
}

// [番号, レアリティ, カード名, slug, タイプ, ステージ, HP, イラストレーター, 絵師人気, キャラ人気, 品薄度, 競技採用, spec備考, collector備考]
const ROWS = [
  // ── AR ───────────────────────────────────────────────────────
  ['70', 'AR', 'ゴウカザル', 'infernape', '炎', '2進化', 140, 'Krgc', 'mid', 'mid', 'normal', 'none',
    '2進化の炎ポケモン。シンオウ御三家ヒコザル系の最終進化。',
    'Krgc による描き下ろしAR。シンオウ御三家の最終進化として一定のコレクター需要はあるが、AR帯では中位の相場。'],
  ['75', 'AR', 'ヒスイ ガーディ', 'hisuian-growlithe', '闘', 'たね', 80, 'GIDORA', 'high', 'mid', 'normal', 'none',
    'たねの闘ポケモン。ヒスイのすがたのガーディ。',
    'GIDORA によるヒスイガーディのAR。作家人気が高く、ヒスイ地方のリージョンフォームはコレクター人気も安定。AR帯ではイーブイに次ぐ。'],
  ['78', 'AR', 'イーブイ', 'eevee', '無', 'たね', 50, 'Narumi Sato', 'mid', 'high', 'normal', 'low',
    '特性で山札から進化先を直接のせて進化できる。',
    'Narumi Sato によるイーブイAR。イーブイはポケカ全体で最も安定した需要があるキャラで、この弾のAR帯で最高額。'],

  // ── SR ───────────────────────────────────────────────────────
  ['82', 'SR', 'サケブシッポex', 'scream-tail-ex', '超', 'たね', 190, 'PLANETA Hiiragi', 'mid', 'mid', 'normal', 'mid',
    'たねの超ポケモンex。パラドックス（古代）のプクリンの姿をしたポケモン。',
    'PLANETA Hiiragi による通常イラストSR。古代パラドックス勢はキャラ人気が成熟しておらず、SR帯では中位。'],
  ['83', 'SR', 'ゲッコウガex', 'greninja-ex', '闘', '2進化', 310, '5ban Graphics', 'mid', 'high', 'normal', 'high',
    '2進化の闘ポケモンex。HP310。SAR(090)と同スペックの通常イラスト版。',
    '5ban Graphics による通常イラストSR。SAR(090)が突出して高いため、その受け皿としてSR帯トップの相場。'],
  ['87', 'SR', 'サザレ', 'lacey', 'サポート', 'サポート', 0, 'Naoki Saito', 'high', 'high', 'normal', 'mid',
    'サポート。ブルーベリー学園の四天王サザレ。',
    'Naoki Saito による通常イラストSR。SAR(092)の受け皿で、女性トレーナーSRとして安定した需要がある。'],
  ['88', 'SR', 'スイレンのお世話', 'lanas-aid', 'サポート', 'サポート', 0, 'Atsushi Furusawa', 'mid', 'high', 'normal', 'high',
    'サポート。自分のトラッシュからポケモンと基本エネルギーを合計3枚まで手札に加える。',
    'Atsushi Furusawa による通常イラストSR。回収サポートとして構築での実需が長く、SR帯ではゲッコウガexと並ぶ上位。'],

  // ── SAR ──────────────────────────────────────────────────────
  ['89', 'SAR', 'ヤバソチャex', 'sinistcha-ex', '草', '1進化', 240, 'Saboteri', 'mid', 'mid', 'normal', 'mid',
    '1進化の草ポケモンex。エネルギー回収と全体回復を持つ。',
    'Saboteri による描き下ろしSAR。キタカミの新ポケモンでキャラ人気が成熟しておらず、SAR帯では下位。'],
  ['90', 'SAR', 'ゲッコウガex', 'greninja-ex', '闘', '2進化', 310, 'akagi', 'high', 'high', 'scarce', 'high',
    '2進化の闘ポケモンex。HP310。1つ目のワザで山札を探し、2つ目でエネ2枚をトラッシュし相手2匹に120ダメージ。',
    'akagi による描き下ろしSAR。ゲッコウガはポケカ屈指の人気キャラで、この弾のチェイスそのもの。2位のサザレSARに4倍近い差をつける単独トップ。'],
  ['91', 'SAR', 'ガチグマ アカツキex', 'bloodmoon-ursaluna-ex', '無', 'たね', 260, 'MINAMINAMI Take', 'mid', 'mid', 'normal', 'high',
    'たねの無色ポケモンex。特性で相手が取ったサイド枚数に応じて「ブラッドムーン」の必要エネが減る。',
    'MINAMINAMI Take による描き下ろしSAR。構築での実需が強かったカードだが、キャラ人気は中位でSAR帯では下位寄り。'],
  ['92', 'SAR', 'サザレ', 'lacey', 'サポート', 'サポート', 0, 'GIDORA', 'high', 'high', 'normal', 'mid',
    'サポート。手札のポケモンを2枚まで山札にもどし、その枚数ぶん山札からポケモンを手札に加える。',
    'GIDORA によるサザレSAR。ブルーベリー学園の四天王で、女性トレーナーSARとして人気が高くこの弾の第2チェイス。'],
  ['93', 'SAR', 'スイレンのお世話', 'lanas-aid', 'サポート', 'サポート', 0, 'Toshinao Aoki', 'mid', 'high', 'normal', 'high',
    'サポート。自分のトラッシュからポケモン（ルールを持つポケモンをのぞく）と基本エネルギーを合計3枚まで手札に加える。',
    'Toshinao Aoki によるスイレンSAR。アローラの試練の少女スイレンは根強い人気があり、構築実需と重なってSAR帯の上位。'],

  // ── UR ───────────────────────────────────────────────────────
  ['95', 'UR', '緊急ボード', 'emergency-board', 'ポケモンのどうぐ', 'ポケモンのどうぐ', 0, 'Toyste Beach', 'mid', 'low', 'normal', 'high',
    'ポケモンのどうぐ。ついているポケモンの逃げるエネルギーを1個ぶん少なくし、残りHPが30以下なら0にする。',
    'この弾のURで最も高い。逃げエネを軽くするどうぐとして構築採用が長く続き、プレイヤー需要で値持ちしている実用UR。'],
]

const data = JSON.parse(fs.readFileSync(DATA, 'utf-8'))

// box を upsert（再実行できるように）
const bi = data.boxes.findIndex((b) => b.box_id === BOX)
if (bi >= 0) data.boxes[bi] = BOX_ENTRY
else data.boxes.push(BOX_ENTRY)

const before = data.cards.filter((c) => c.box_id === BOX).length
data.cards = data.cards.filter((c) => c.box_id !== BOX) // 再実行できるよう既存分は入れ替え

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
      source: 'limitlesstcg.com/cards/jp/SV5a/{番号} で名称・番号・HP・タイプ・ステージ・イラストレーターを1枚ずつ確認（2026-08-27）',
    },
    note: '',
  })
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`${BOX}: ${before} -> ${ROWS.length} 枚（合計 ${data.cards.length} 枚 / ${data.boxes.length} box）`)
const ids = data.cards.map((c) => c.id)
const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
console.log(dup.length ? `⚠️ 重複ID: ${dup.join(', ')}` : 'ID重複なし')
