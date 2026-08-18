// ハイクラスパック VSTARユニバース（S12a・2022-12-02発売）の高額チェイス18枚を追加する。
// カード名/番号/HP/タイプ/ステージ/イラストレーターは limitlesstcg.com/cards/jp/S12a/{番号} で1枚ずつ確認（2026-08-19）。
// 選定基準＝遊々亭の買取一覧（https://yuyu-tei.jp/buy/poc/s/s12a）で買取1,200円以上の帯。
// 買取600〜800円のAR（185デオキシス/195ラティアス/202チルット/203ヨマワル/204ビッパ/208ポチエナ）は
// 薄商いで欠測しやすいため見送り。SR枠も同様。
import fs from 'node:fs'

const DATA = 'C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json'
const BOX = 'vstar_universe'
const PREFIX = 'vstar-universe'
const TOTAL = '172'
const img = (n) => `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/S12a/S12a_${n}_R_JP_LG.png`

const BOX_ENTRY = {
  box_id: BOX,
  box_name: 'VSTARユニバース',
  code: 'S12a',
  release_ym: '2022-12',
  certainty: 'released',
  pack_price_yen: 550,
  packs_per_box: 10,
  pack_image_url: 'https://archives.bulbagarden.net/media/upload/7/79/S12a_VSTAR_Universe_pack.jpg',
  note: '2022-12-02発売のハイクラスパック（1パック10枚・1BOX10パック）。剣盾期の総集編としてVSTAR/VMAXを網羅し、斉藤こうきのAR群とSAR/URを大量収録。長期絶版でピカチュウAR(205)が突出した最高額。',
}

// [番号, レアリティ, カード名, slug, タイプ, ステージ, HP, イラストレーター, 絵師人気, キャラ人気, 品薄度, 競技採用, spec備考, collector備考]
const ROWS = [
  // ── AR 183-209 ───────────────────────────────────────────────
  ['183', 'AR', 'ミュウ', 'mew', '超', 'たね', 60, 'Ryota Murayama', 'mid', 'high', 'normal', 'high',
    '特性「ふしぎなしっぽ」=バトル場にいるとき山札を上から6枚見てグッズを1枚手札に／ワザ「サイコショット」30。',
    '幻のポケモン・ミュウのAR。ミュウVMAXデッキの必須枠として実需が長く続いた上に、キャラ人気も高くAR帯の第2位相場。'],
  ['201', 'AR', 'リオル', 'riolu', '闘', 'たね', 60, 'Kouki Saitou', 'high', 'mid', 'normal', 'low',
    'ワザ「けたぐり」=闘エネ2個で50ダメージ。',
    '斉藤こうきによるAR群の1枚。ルカリオの進化前として人気があり、AR帯では中位以上の相場。'],
  ['205', 'AR', 'ピカチュウ', 'pikachu', '雷', 'たね', 60, 'Kouki Saitou', 'high', 'high', 'scarce', 'low',
    '特性「ピカダッシュ」=エネルギーがついているならにげるエネが0／ワザ「きまぐれタックル」コイン判定。',
    '斉藤こうきが描いた「木の上のピカチュウ」。この弾のトップレアで、AR でありながらSAR/URを上回る最高額。ポケカ全体でも指折りの人気ARとして長期的に堅い。'],
  ['206', 'AR', 'ナエトル', 'turtwig', '草', 'たね', 80, 'Kouki Saitou', 'high', 'mid', 'normal', 'none',
    'ワザ「かみつく」10／「とびだしヘッド」20。',
    '斉藤こうきのAR。シンオウ御三家の草枠で、同弾のAR群のなかでは中位の相場。'],
  ['209', 'AR', 'メリープ', 'mareep', '雷', 'たね', 60, 'Kouki Saitou', 'high', 'mid', 'normal', 'none',
    'ワザ「うしろげり」10／「エレキボール」30。',
    '斉藤こうきのAR。牧歌的な構図でイラスト評価が高く、かわいい系ARとして安定した需要がある。'],

  // ── SAR 210-243 ──────────────────────────────────────────────
  ['210', 'SAR', 'リーフィアVSTAR', 'leafeon-vstar', '草', 'VSTAR', 260, 'Jiro Sasumo', 'mid', 'high', 'normal', 'mid',
    'VSTARパワー「アイビースター」=相手のベンチを1匹バトル場に／ワザ「リーフガード」180＋次の番ダメージ-30。',
    'イーブイ進化系のSAR。イーブイズはコレクター人気が厚く、SAR帯で安定した中位以上の相場。'],
  ['211', 'SAR', 'リザードンV', 'charizard-v', '炎', 'たね', 220, 'Oswaldo KATO', 'high', 'high', 'normal', 'mid',
    'ワザ「やきつくす」90＋相手のどうぐをトラッシュ／「ヒートブラスト」180。',
    'Oswaldo KATO による夕景のリザードンV。リザードン人気でSAR帯の上位に定着している。'],
  ['214', 'SAR', 'バオッキーVSTAR', 'simisear-vstar', '炎', 'VSTAR', 260, 'nagano', 'high', 'mid', 'normal', 'low',
    'ワザ「ひのたまフィーバー」=山札を5枚までトラッシュしその枚数×40追加／VSTARパワー「エンバースター」。',
    'nagano による独特の色彩のSAR。キャラ人気は高くないが作家性でコレクター評価が高く、SAR帯の中位以上を維持。'],
  ['217', 'SAR', 'グレイシアVSTAR', 'glaceon-vstar', '水', 'VSTAR', 260, 'Gemi', 'high', 'high', 'normal', 'mid',
    'ワザ「つららショット」180＋にげられない／VSTARパワー「クリスタルスター」220＋次の番ダメージ・効果を受けない。',
    'Gemi による氷景のグレイシアSAR。イーブイズ人気＋作家人気が重なりSAR帯の上位。'],
  ['218', 'SAR', 'ライコウV', 'raikou-v', '雷', 'たね', 200, 'nagimiso', 'high', 'high', 'normal', 'mid',
    '特性「しゅんそく」=バトル場にいるとき山札を1枚引く／ワザ「ライトニングロンド」20＋ベンチの数×20。',
    'nagimiso による疾走感のあるライコウV。伝説三犬の人気と作家人気が重なるSAR帯上位の定番。'],
  ['221', 'SAR', 'ミュウツーVSTAR', 'mewtwo-vstar', '超', 'VSTAR', 280, 'GOSSAN', 'high', 'high', 'scarce', 'mid',
    'ワザ「サイコパージ」=超エネを3枚までトラッシュしその枚数×90／VSTARパワー「スターレイド」=相手のポケモンV全員に120。',
    'GOSSAN によるミュウツーVSTAR。ミュウツーの知名度と迫力ある構図でこの弾のSAR最高額。'],
  ['226', 'SAR', 'ルカリオVSTAR', 'lucario-vstar', '闘', 'VSTAR', 270, 'hncl', 'mid', 'high', 'normal', 'mid',
    'ワザ「ファイティングナックル」120（相手がVならさらに120）／VSTARパワー「はどうスター」=相手の場のエネの数×70。',
    'ルカリオのSAR。キャラ人気は高いがSAR帯では中位の相場で、リオルAR(201)との組み合わせ需要がある。'],
  ['236', 'SAR', 'カイ', 'kai', 'サポート', 'サポート', 0, 'Naoki Saito', 'high', 'high', 'scarce', 'high',
    'サポート。山札から水ポケモンとグッズを1枚ずつ手札に加える。',
    'Naoki Saito によるカイのSAR。水デッキの必須サポートとして実需が長く続き、女性キャラSARとしてこの弾のトレーナーズ最高額。'],
  ['239', 'SAR', 'シロナの覇気', 'cynthia-ambition', 'サポート', 'サポート', 0, 'Atsuya Uki', 'high', 'high', 'normal', 'high',
    'サポート。手札が5枚（前の番に自分のポケモンがきぜつしていたなら8枚）になるように引く。',
    '宇木敦哉による「シロナの覇気」SAR。シロナはシリーズ屈指の人気キャラで、作家人気と重なりSAR帯の上位。'],

  // ── UR 259-262 ───────────────────────────────────────────────
  ['259', 'UR', 'オリジンパルキアVSTAR', 'origin-palkia-vstar', '水', 'VSTAR', 280, 'AKIRA EGAWA', 'mid', 'high', 'normal', 'high',
    'VSTARパワー「スターポータル」=トラッシュから水エネを3枚まで加速／ワザ「あくうのうねり」60＋相手ベンチの数×20。',
    'ゴールド仕様のUR。オリジンフォルムのパルキアは人気が高く、UR帯の中位相場。'],
  ['260', 'UR', 'オリジンディアルガVSTAR', 'origin-dialga-vstar', '鋼', 'VSTAR', 280, 'AKIRA EGAWA', 'mid', 'high', 'normal', 'high',
    'ワザ「メタルブラスト」=ついている鋼エネの数×40追加／VSTARパワー「スタークロノス」=もう1回自分の番を始める。',
    'ゴールド仕様のUR。「もう1回自分の番」という象徴的な効果でプレイヤー人気も高く、UR帯の上位。'],
  ['261', 'UR', 'ギラティナVSTAR', 'giratina-vstar', '竜', 'VSTAR', 280, 'AKIRA EGAWA', 'mid', 'high', 'scarce', 'high',
    'ワザ「ロストインパクト」／VSTARパワー「スターレクイエム」=ロストゾーンが10枚以上なら相手のバトルポケモンをきぜつ。',
    'ゴールド仕様のUR。ロストギラティナは剣盾末期を代表する強力デッキで、キャラ人気と合わせてこの弾のUR最高額。'],
  ['262', 'UR', 'アルセウスVSTAR', 'arceus-vstar', '無', 'VSTAR', 280, 'AKIRA EGAWA', 'mid', 'high', 'normal', 'high',
    'VSTARパワー「スターバース」=山札から好きなカードを2枚手札に／ワザ「トリニティノヴァ」=基本エネを3枚まで加速。',
    'ゴールド仕様のUR。「スターバース」は剣盾期を象徴するカードで、環境の顔だった実績からUR帯の上位を維持。'],
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
      player: { regulation_mark: 'F', rotation: 'far', competitive_usage: usage },
      collector: { illustrator: illus, illustrator_popularity: illusPop, artwork_type: 'original', rarity },
      common: { reprint_status: 'none', scarcity, character_popularity: charPop },
    },
    evidence_notes: {
      player: '',
      collector: colNote,
      source: 'limitlesstcg.com/cards/jp/S12a/{番号} で名称・番号・HP・タイプ・ステージ・イラストレーターを1枚ずつ確認（2026-08-19）',
    },
    note: '',
  })
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`${BOX}: ${before} -> ${ROWS.length} 枚（合計 ${data.cards.length} 枚 / ${data.boxes.length} box）`)
const ids = data.cards.map((c) => c.id)
const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
console.log(dup.length ? `⚠️ 重複ID: ${dup.join(', ')}` : 'ID重複なし')
