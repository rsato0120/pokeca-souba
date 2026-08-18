// ハイクラスパック VMAXクライマックス（S8b・2021-12-03発売）の高額チェイス18枚を追加する。
// カード名/番号/HP/タイプ/ステージ/イラストレーターは limitlesstcg.com/cards/jp/S8b/{番号} で1枚ずつ確認（2026-08-19）。
// UR(278-285)だけは limitless が持っていない（CDN 403・カードページも404）ため serebii.net/card/vmaxclimax/{番号}.shtml で確認し、
// 画像は TCGplayer CDN を使う（serebii の画像は 695バイトのプレースホルダでNG）。
// 選定基準＝マスターズスクウェアの販売一覧（https://www.tcgacademy.com/product-list/3154）の高額帯。
import fs from 'node:fs'

const DATA = 'C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json'
const BOX = 'vmax_climax'
const PREFIX = 'vmax-climax'
const TOTAL = '184'

// UR(278-285)は limitless に無いので TCGplayer CDN へフォールバック。
// productId は Web検索でカードページを引き、mp-search-api の productName で実カードを照合済み。
const TCG_PRODUCT = { 279: 571530, 280: 571531, 284: 571535 }
const img = (n) =>
  TCG_PRODUCT[Number(n)]
    ? `https://tcgplayer-cdn.tcgplayer.com/product/${TCG_PRODUCT[Number(n)]}_in_1000x1000.jpg`
    : `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/S8b/S8b_${n}_R_JP_LG.png`

const BOX_ENTRY = {
  box_id: BOX,
  box_name: 'VMAXクライマックス',
  code: 'S8b',
  release_ym: '2021-12',
  certainty: 'released',
  pack_price_yen: 550,
  packs_per_box: 10,
  pack_image_url: 'https://archives.bulbagarden.net/media/upload/4/45/S8b_VMAX_Climax_pack.jpg',
  note: '2021-12-03発売のハイクラスパック（1パック11枚・1BOX10パック）。剣盾期のV/VMAXを網羅した総集編で、CSR（キャラクタースーパーレア）が目玉。長期絶版でBOX相場は定価の約5倍まで上昇している。',
}

// [番号, レアリティ, カード名, slug, タイプ, ステージ, HP, イラストレーター, 絵師人気, キャラ人気, 品薄度, 競技採用, spec備考, collector備考]
const ROWS = [
  // ── CSR 217-252 ──────────────────────────────────────────────
  // 217 バシャーモVMAX CSR は snkrdunk に出品ページが無く PSA10 を取れないため、
  // 同じ絵柄ペアで買取が上の 216 バシャーモV CSR を採用した。
  ['216', 'CSR', 'バシャーモV', 'blaziken-v', '炎', 'たね', 210, 'nagimiso', 'high', 'mid', 'normal', 'mid',
    'ワザ「とびひざげり」50／「ほのおのうず」210（エネを2個トラッシュ）。',
    'nagimiso による夕景のバシャーモV。作家人気が高くCSR帯の中位以上を維持している。'],
  ['222', 'CSR', 'ピカチュウV', 'pikachu-v', '雷', 'たね', 190, 'Ryota Murayama', 'mid', 'high', 'normal', 'mid',
    'ワザ「じゅうでん」=山札から雷エネを2枚まで加速／「10まんボルト」200＋エネを全トラッシュ。',
    'ピカチュウVMAX(223)と対になるCSR。ピカチュウのキャラ人気でCSR帯の上位。'],
  ['223', 'CSR', 'ピカチュウVMAX', 'pikachu-vmax', '雷', 'VMAX', 310, 'Souichirou Gunjima', 'high', 'high', 'scarce', 'mid',
    'ワザ「キョダイボルテッカー」120＋エネを全トラッシュで150追加。',
    '権島蒼一郎による街を駆けるピカチュウVMAX。ピカチュウCSRはこの弾でミミッキュVMAXと並ぶトップ級の相場。'],
  ['231', 'CSR', 'ニンフィアV', 'sylveon-v', '超', 'たね', 200, 'Megumi Mizutani', 'mid', 'high', 'normal', 'mid',
    '特性「ドリームギフト」=山札からグッズを1枚手札に（使うと番が終わる）／ワザ「マジカルショット」60。',
    'ニンフィアVMAX(232)と対になるCSR。イーブイズはコレクター人気が厚くCSR帯の中位以上。'],
  ['232', 'CSR', 'ニンフィアVMAX', 'sylveon-vmax', '超', 'VMAX', 310, 'sui', 'high', 'high', 'normal', 'mid',
    'ワザ「プレシャスタッチ」=ベンチにエネを付けHP120回復／「ダイハーモニー」70＋ベンチのタイプ数×30。',
    'sui による淡色のニンフィアVMAX。イーブイズ人気＋作家人気でCSR帯の上位。'],
  ['233', 'CSR', 'ミミッキュV', 'mimikyu-v', '超', 'たね', 160, 'saino misaki', 'high', 'high', 'normal', 'mid',
    '特性「ダミードール」=ベンチから出した番は相手のワザのダメージを受けない／ワザ「うらやむひとみ」。',
    'ミミッキュVMAX(234)と対になるCSR。ミミッキュはこの弾で最も人気のあるキャラの一角。'],
  ['234', 'CSR', 'ミミッキュVMAX', 'mimikyu-vmax', '超', 'VMAX', 300, 'Naoki Saito', 'high', 'high', 'scarce', 'mid',
    'ワザ「オカルトナンバー」=ダメカン4個（「アセロラの予感」を使っていれば13個）／「ダイシャドー」120＋手札1枚トラッシュ。',
    '斎藤ナオキによるミミッキュVMAX。アセロラの予感(255)と絵が繋がる仕掛けで有名で、この弾のCSR最高額。'],
  ['244', 'CSR', 'ブラッキーV', 'umbreon-v', '悪', 'たね', 200, 'Ligton', 'mid', 'high', 'normal', 'mid',
    'ワザ「くろいまなざし」30＋にげられない／「げっこうのやいば」80＋ダメカンがのっていれば80追加。',
    'ブラッキーVMAX(245)と対になるCSR。ブラッキーはイーブイズで最も人気が高くCSR帯の上位。'],
  ['245', 'CSR', 'ブラッキーVMAX', 'umbreon-vmax', '悪', 'VMAX', 310, 'kawayoo', 'high', 'high', 'scarce', 'mid',
    '特性「ダークシグナル」=進化時に相手のベンチを1匹バトル場へ／ワザ「ダイアーク」160。',
    'kawayoo によるブラッキーVMAX。イーブイヒーローズのSA版ほどではないがCSR帯のトップ級で、海外人気も厚い。'],
  ['252', 'CSR', 'レックウザVMAX', 'rayquaza-vmax', '竜', 'VMAX', 320, 'Hideki Ishikawa', 'high', 'high', 'normal', 'mid',
    '特性「そうくうのはどう」=手札を全てトラッシュして3枚引く／ワザ「ダイバースト」=炎・雷エネをトラッシュした枚数×80追加。',
    '石川英樹によるレックウザVMAX。蒼空ストリームのSAに次ぐレックウザ枠で、CSR帯の上位。'],

  // ── SR 255-277 ───────────────────────────────────────────────
  ['255', 'SR', 'アセロラの予感', 'acerola-premonition', 'サポート', 'サポート', 0, 'yuu', 'high', 'high', 'scarce', 'high',
    'サポート。相手の手札を見て、その中のトレーナーズの枚数ぶん山札を引く。',
    'yuu による、この弾を象徴するトレーナーズSR。ミミッキュVMAX(234)と絵が繋がる演出で人気が爆発し、S8bの最高額カード。'],
  ['258', 'SR', 'ガラルの仲間たち', 'galarian-friends', 'サポート', 'サポート', 0, 'Sanosuke Sakuma', 'high', 'high', 'scarce', 'high',
    'サポート。自分の山札を3枚引く。',
    '佐野助によるガラルのジムリーダー集合絵。効果は地味だが「集合イラスト」の希少性でSR帯の上位に定着。'],
  ['261', 'SR', 'サイトウ', 'bea', 'サポート', 'サポート', 0, 'Souichirou Gunjima', 'high', 'mid', 'normal', 'mid',
    'サポート。山札を上から5枚トラッシュし、その中のエネルギーをベンチの闘ポケモンにつける。',
    '権島蒼一郎によるサイトウのSR。女性キャラSRとして安定した需要があり、SR帯の中位。'],
  ['276', 'SR', 'ユウリ', 'gloria', 'サポート', 'サポート', 0, 'Naoki Saito', 'high', 'high', 'scarce', 'high',
    'サポート。山札からたねポケモン（ルールを持つポケモンを除く）を3枚までベンチに出す。',
    '斎藤ナオキによる主人公ユウリのSR。アセロラの予感に次ぐこの弾の第2チェイスで、作家人気と主人公補正が重なる。'],
  ['277', 'SR', 'ルリナ', 'nessa', 'サポート', 'サポート', 0, 'saino misaki', 'high', 'high', 'normal', 'mid',
    'サポート。トラッシュから水ポケモンと水エネルギーを合計4枚まで手札に加える。',
    'saino misaki によるルリナのSR。人気ジムリーダーでSR帯の上位を維持している。'],

  // ── UR 279-284（limitless非収録・TCGplayer CDN画像）─────────────
  ['279', 'UR', 'ピカチュウVMAX', 'pikachu-vmax', '雷', 'VMAX', 310, 'aky CG Works', 'mid', 'high', 'scarce', 'mid',
    'CSR(223)と同スペックのゴールド仕様。ワザ「キョダイボルテッカー」120＋エネを全トラッシュで150追加。',
    'ゴールド仕様のUR。ピカチュウ＋金加工でUR帯のトップ級。この弾のUR最高額を争う。'],
  ['280', 'UR', 'ミュウVMAX', 'mew-vmax', '超', 'VMAX', 310, '5ban Graphics', 'mid', 'high', 'normal', 'high',
    'ゴールド仕様。ワザ「クロスフュージョンストライク」=ベンチのフュージョンのワザを使う／「ダイミラクル」130（相手にかかっている効果を受けない）。',
    'ゴールド仕様のUR。ミュウVMAXは剣盾期の主力デッキで実需もあり、UR帯の上位。'],
  ['284', 'UR', 'レックウザVMAX', 'rayquaza-vmax', '竜', 'VMAX', 320, 'PLANETA Mochizuki', 'mid', 'high', 'scarce', 'mid',
    'CSR(252)と同スペックのゴールド仕様。特性「そうくうのはどう」／ワザ「ダイバースト」。',
    'ゴールド仕様のUR。レックウザ人気＋金加工でこの弾のUR最高額。'],
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
      player: { regulation_mark: 'E', rotation: 'far', competitive_usage: usage },
      collector: { illustrator: illus, illustrator_popularity: illusPop, artwork_type: 'original', rarity },
      common: { reprint_status: 'none', scarcity, character_popularity: charPop },
    },
    evidence_notes: {
      player: '',
      collector: colNote,
      source: 'limitlesstcg.com/cards/jp/S8b/{番号}（UR 279/280/284 は serebii.net/card/vmaxclimax/{番号}.shtml）で名称・番号・HP・タイプ・ステージ・イラストレーターを1枚ずつ確認（2026-08-19）',
    },
    note: '',
  })
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`${BOX}: ${before} -> ${ROWS.length} 枚（合計 ${data.cards.length} 枚 / ${data.boxes.length} box）`)
const ids = data.cards.map((c) => c.id)
const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
console.log(dup.length ? `⚠️ 重複ID: ${dup.join(', ')}` : 'ID重複なし')
