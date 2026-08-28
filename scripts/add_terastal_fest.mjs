// ハイクラスパック テラスタルフェスex（SV8a・2024-12-06発売）の高額チェイス21枚を追加する。
// カード名/番号/HP/タイプ/ステージ/イラストレーターは limitlesstcg.com/cards/jp/SV8a/{番号} で1枚ずつ確認（2026-08-27）。
// 選定基準＝遊々亭の販売一覧（https://yuyu-tei.jp/sell/poc/s/sv08a）の高額帯。
// ブイズ8種＋イーブイex2種はこの弾の中心なので、単価が低めのものも欠かさず全部入れる
// （1種でも欠けると「ブイズが揃わない」ページになり、この弾を見に来る動機そのものを損なう）。
// オーガポン4種SAR（201/204/208/216・¥780〜880）とテツノ系の一部は薄商いのため見送り。
// ⚠️ 画像URLは **先頭ゼロなし**（SV8a_217_R_JP_LG.png）。3桁番号はそのまま。
import fs from 'node:fs'

const DATA = 'C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json'
const BOX = 'terastal_fest'
const PREFIX = 'terastal-fest'
const TOTAL = '187'
const img = (n) => `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SV8a/SV8a_${Number(n)}_R_JP_LG.png`

const BOX_ENTRY = {
  box_id: BOX,
  box_name: 'テラスタルフェスex',
  code: 'SV8a',
  release_ym: '2024-12',
  certainty: 'released',
  pack_price_yen: 550,
  packs_per_box: 10,
  pack_image_url: 'https://archives.bulbagarden.net/media/upload/b/b4/SV8a_Terastal_Fest_ex_pack.png',
  note: '2024-12-06発売のハイクラスパック（1パック10枚・1BOX10パック）。イーブイと進化系「ブイズ」全8種をテラスタルのポケモンexとしてSARで揃えた年末の総集編弾。イーブイex SARは2種（223 tono / 224 Natsuko Shoji été）。ブラッキーex SAR(217)が突出した最高額で、ピカチュウex UR(236)がそれに次ぐ。キャラ人気が全カードに乗るためコレクター需要が非常に厚い。本サイトは相場が動く高額帯21枚を掲載。',
}

// [番号, レアリティ, カード名, slug, タイプ, ステージ, HP, イラストレーター, 絵師人気, キャラ人気, 品薄度, 競技採用, spec備考, collector備考]
const ROWS = [
  // ── SAR: ブイズ8種 ───────────────────────────────────────────
  ['200', 'SAR', 'リーフィアex', 'leafeon-ex', '草', '1進化', 270, 'Jiro Sasumo', 'mid', 'high', 'normal', 'low',
    '1進化の草ポケモンex。イーブイから進化。HP270。',
    'Jiro Sasumo による描き下ろしSAR。ブイズの中では草タイプの人気枠で、エーフィexと並ぶ中位帯。'],
  ['202', 'SAR', 'ブースターex', 'flareon-ex', '炎', '1進化', 270, 'Nurikabe', 'mid', 'high', 'normal', 'low',
    '1進化の炎ポケモンex。イーブイから進化。HP270。',
    'Nurikabe による描き下ろしSAR。初代ブイズ3種の1体で安定した需要があるが、ブイズ内では中位。'],
  ['205', 'SAR', 'シャワーズex', 'vaporeon-ex', '水', '1進化', 280, 'Narano', 'mid', 'high', 'normal', 'low',
    '1進化の水ポケモンex。イーブイから進化。HP280。',
    'Narano による描き下ろしSAR。初代ブイズ3種の1体。ブイズ内では中位だが、初代勢は長期的に堅い。'],
  ['206', 'SAR', 'グレイシアex', 'glaceon-ex', '水', '1進化', 270, 'Kamome Shirahama', 'high', 'high', 'normal', 'low',
    '1進化の水ポケモンex。イーブイから進化。HP270。',
    'Kamome Shirahama（漫画家・魔女の下僕と魔王のツノ）による描き下ろしSAR。作家人気が乗りブイズ内では上位。'],
  ['209', 'SAR', 'サンダースex', 'jolteon-ex', '雷', '1進化', 260, 'kantaro', 'mid', 'high', 'normal', 'low',
    '1進化の雷ポケモンex。イーブイから進化。HP260。',
    'kantaro による描き下ろしSAR。初代ブイズ3種の1体で、ブイズ内では中位。'],
  ['211', 'SAR', 'エーフィex', 'espeon-ex', '超', '1進化', 270, 'sui', 'mid', 'high', 'normal', 'low',
    '1進化の超ポケモンex。イーブイから進化。HP270。',
    'sui による描き下ろしSAR。ブラッキーと対になる第2世代ブイズで、女性人気が高くブイズ内では上位。'],
  ['212', 'SAR', 'ニンフィアex', 'sylveon-ex', '超', '1進化', 270, 'Cona Nitanda', 'high', 'high', 'scarce', 'low',
    '1進化の超ポケモンex。イーブイから進化。ワザ「マジカルチャーム」160／「エンジェライト」で相手のベンチを山札にもどす。',
    'Cona Nitanda による描き下ろしSAR。ブイズ内でブラッキーexに次ぐ第2位で、この弾の準チェイス。'],
  ['217', 'SAR', 'ブラッキーex', 'umbreon-ex', '悪', '1進化', 280, 'YASHIRO Nanaco', 'high', 'high', 'scarce', 'low',
    '1進化の悪ポケモンex。イーブイから進化。ワザ「ムーンミラージュ」でこんらん／「オニキス」はエネを全てトラッシュしサイドを1枚取る。',
    'YASHIRO Nanaco による描き下ろしSAR。ブラッキーはブイズ最大の人気キャラで、この弾の単独チェイス。2位のニンフィアexに3倍以上の差をつける。'],

  // ── SAR: イーブイex 2種 ──────────────────────────────────────
  ['223', 'SAR', 'イーブイex', 'eevee-ex', '無', 'たね', 200, 'tono', 'mid', 'high', 'normal', 'low',
    'たねの無色ポケモンex。HP200。ブイズ全種の進化元。',
    'tono による描き下ろしSAR。イーブイex SARは2種あり、こちらは223番。ブイズを集めるコレクターが必ず一緒に買う枠。'],
  ['224', 'SAR', 'イーブイex', 'eevee-ex', '無', 'たね', 200, 'Natsuko Shoji été', 'high', 'high', 'normal', 'low',
    'たねの無色ポケモンex。HP200。223と同スペックの別イラスト。',
    'パティシエ Natsuko Shoji（été）による描き下ろしSAR。異業種アーティストの起用で話題になった1枚で、223と同水準の相場。'],

  // ── SAR: その他ポケモン ──────────────────────────────────────
  ['213', 'SAR', 'テツノブジンex', 'iron-valiant-ex', '超', 'たね', 220, 'danciao', 'mid', 'mid', 'normal', 'mid',
    'たねの超ポケモンex。未来パラドックス。HP220。',
    'danciao による描き下ろしSAR。未来パラドックス勢はキャラ人気が中位で、ブイズ以外のSAR帯では中位。'],
  ['218', 'SAR', 'トドロクツキex', 'roaring-moon-ex', '悪', 'たね', 230, 'Shinji Kanda', 'mid', 'high', 'normal', 'high',
    'たねの悪ポケモンex。古代パラドックス。HP230。',
    'Shinji Kanda による描き下ろしSAR。古代パラドックス勢で最も人気が高く構築実需も強い。ブイズ以外では最高額。'],
  ['221', 'SAR', 'ドラパルトex', 'dragapult-ex', '竜', '2進化', 320, 'Jerky', 'mid', 'high', 'normal', 'high',
    '2進化の竜ポケモンex。HP320。',
    'Jerky による描き下ろしSAR。長期にわたり環境の中心だったカードで、プレイヤー需要が下支えしている。'],
  ['222', 'SAR', 'タケルライコex', 'raging-bolt-ex', '竜', 'たね', 240, 'Uninori', 'mid', 'mid', 'normal', 'high',
    'たねの竜ポケモンex。古代パラドックス。HP240。',
    'Uninori による描き下ろしSAR。構築での実需は非常に強かったが、キャラ人気は中位。'],
  ['225', 'SAR', 'ガチグマ アカツキex', 'bloodmoon-ursaluna-ex', '無', 'たね', 260, 'Yano Keiji', 'mid', 'mid', 'normal', 'high',
    'たねの無色ポケモンex。HP260。クリムゾンヘイズ(SV5a 091)の再録にあたる別イラスト。',
    'Yano Keiji による描き下ろしSAR。SV5a版とは別イラストで、同キャラのSARが2種存在する形。'],

  // ── SAR: トレーナーズ ────────────────────────────────────────
  ['227', 'SAR', 'アカマツ', 'crispin', 'サポート', 'サポート', 0, 'Tomowaka', 'mid', 'mid', 'normal', 'high',
    'サポート。山札からタイプの違う基本エネを2枚まで選び、1枚を手札に、もう1枚を自分のポケモンにつける。',
    'Tomowaka によるアカマツSAR。「藍の円盤」の四天王。エネ加速サポートとして構築実需が強かった。'],
  ['228', 'SAR', 'アンズの秘技', 'kogas-trap', 'サポート', 'サポート', 0, 'Ligton', 'mid', 'mid', 'normal', 'mid',
    'サポート。自分の悪ポケモン2匹までに山札から基本悪エネをつけ、バトル場につけたならどく状態にする。',
    'Ligton によるアンズSAR。カントー四天王の娘で、和風のイラストが評価されている。'],
  ['230', 'SAR', 'スグリ', 'kieran', 'サポート', 'サポート', 0, 'Iori Suzuki', 'mid', 'mid', 'normal', 'high',
    'サポート。バトル場のポケモンをベンチと入れ替えるか、この番 ex・V へのダメージを+30する。',
    'Iori Suzuki によるスグリSAR。「藍の円盤」のライバル。構築実需が強く、トレーナーズSAR帯では上位。'],
  ['231', 'SAR', 'タロ', 'drayton', 'サポート', 'サポート', 0, 'Tomowaka', 'mid', 'mid', 'normal', 'mid',
    'サポート。手札を山札にもどして4枚引く。相手のサイドが残り3枚以下なら8枚引く。',
    'Tomowaka によるタロSAR。ブルーベリー学園の四天王で、アカマツと同じ絵師・同水準の相場。'],

  // ── UR ───────────────────────────────────────────────────────
  ['236', 'UR', 'ピカチュウex', 'pikachu-ex', '雷', 'たね', 200, 'aky CG Works', 'mid', 'high', 'scarce', 'mid',
    'たねの雷ポケモンex。HP200。',
    'aky CG Works によるUR。ピカチュウは常に別格の需要があり、この弾のURで突出して高い。ブイズ以外ではブラッキーexに次ぐ相場。'],
  ['237', 'UR', 'テラパゴスex', 'terapagos-ex', '無', 'たね', 230, '5ban Graphics', 'mid', 'mid', 'normal', 'mid',
    'たねの無色ポケモンex。HP230。この弾のテーマであるテラスタルの象徴ポケモン。',
    '5ban Graphics によるUR。弾のテーマポケモンだが、ピカチュウexほどのキャラ人気は無くUR帯では下位。'],
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
      player: { regulation_mark: 'H', rotation: 'mid', competitive_usage: usage },
      collector: { illustrator: illus, illustrator_popularity: illusPop, artwork_type: 'original', rarity },
      common: { reprint_status: 'none', scarcity, character_popularity: charPop },
    },
    evidence_notes: {
      player: '',
      collector: colNote,
      source: 'limitlesstcg.com/cards/jp/SV8a/{番号} で名称・番号・HP・タイプ・ステージ・イラストレーターを1枚ずつ確認（2026-08-27）',
    },
    note: '',
  })
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`${BOX}: ${before} -> ${ROWS.length} 枚（合計 ${data.cards.length} 枚 / ${data.boxes.length} box）`)
const ids = data.cards.map((c) => c.id)
const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
console.log(dup.length ? `⚠️ 重複ID: ${dup.join(', ')}` : 'ID重複なし')
