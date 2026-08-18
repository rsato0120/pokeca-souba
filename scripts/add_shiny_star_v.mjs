// ハイクラスパック シャイニースターV（S4a・2020-11-20発売）の高額チェイス16枚を追加する。
// カード名/番号/HP/タイプ/ステージ/イラストレーターは limitlesstcg.com/cards/jp/S4a/{番号} で1枚ずつ確認（2026-08-19）。
// UR(327-330)だけは limitless が持っていない（CDN 403）ため serebii.net/card/shinystarv/{番号}.shtml で確認し、
// 画像は TCGplayer CDN を使う。
// 選定基準＝遊々亭の販売一覧（https://yuyu-tei.jp/sell/poc/s/s04a）の高額帯。
// この弾は「リザードン以外の色違いは安い」構造で、実質的に価格が付く銘柄が少ないため16枚。
import fs from 'node:fs'

const DATA = 'C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json'
const BOX = 'shiny_star_v'
const PREFIX = 'shiny-star-v'
const TOTAL = '190'

// UR(327-330)は limitless に無いので TCGplayer CDN へフォールバック。
// productId は mp-search-api の productName で 4枚とも実カードを照合済み。
const TCG_PRODUCT = { 327: 571250, 328: 571251, 329: 571252, 330: 571253 }
const img = (n) =>
  TCG_PRODUCT[Number(n)]
    ? `https://tcgplayer-cdn.tcgplayer.com/product/${TCG_PRODUCT[Number(n)]}_in_1000x1000.jpg`
    : `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/S4a/S4a_${n}_R_JP_LG.png`

const BOX_ENTRY = {
  box_id: BOX,
  box_name: 'シャイニースターV',
  code: 'S4a',
  release_ym: '2020-11',
  certainty: 'released',
  pack_price_yen: 550,
  packs_per_box: 10,
  pack_image_url: 'https://archives.bulbagarden.net/media/upload/a/a6/S4a_Shiny_Star_V_pack.jpg',
  note: '2020-11-20発売のハイクラスパック（1パック10枚・1BOX10パック）。色違いポケモン127種を収録した「色違い弾」の元祖で、リザードンV/VMAXのSSRが突出したチェイス。長期絶版でBOX相場は定価の約3倍。',
}

// [番号, レアリティ, カード名, slug, タイプ, ステージ, HP, イラストレーター, 絵師人気, キャラ人気, 品薄度, 競技採用, spec備考, collector備考]
const ROWS = [
  // ── SR（トレーナーズ）195-198 ────────────────────────────────
  ['195', 'SR', 'フウロ', 'skyla', 'サポート', 'サポート', 0, 'kirisAki', 'high', 'high', 'normal', 'mid',
    'サポート。山札からトレーナーズを1枚選び、手札に加える。',
    'kirisAki によるフウロのSR。イッシュのジムリーダーで女性キャラ人気が高く、マリィに次ぐこの弾のトレーナーズ上位。'],
  ['197', 'SR', 'ポケモンごっこ', 'poke-kid', 'サポート', 'サポート', 0, 'Sanosuke Sakuma', 'high', 'mid', 'normal', 'mid',
    'サポート。山札からポケモンを1枚選び、手札に加える。',
    '佐野助による「ポケモンごっこ」のSR。ピカチュウの着ぐるみを着た子どものイラストが人気で、キャラ物SRとして根強い需要がある。'],
  ['198', 'SR', 'マリィ', 'marnie', 'サポート', 'サポート', 0, 'Naoki Saito', 'high', 'high', 'scarce', 'high',
    'サポート。おたがいに手札を山札の下にもどし、自分は5枚・相手は4枚引く。',
    '斎藤ナオキによるマリィのSR。剣盾期のトレーナーズSRを代表するカードで、この弾のトレーナーズ最高額。'],

  // ── S（色違いレア）200-238 ───────────────────────────────────
  ['200', 'S', 'モクロー', 'rowlet', '草', 'たね', 50, 'Akira Komayama', 'high', 'high', 'normal', 'none',
    '特性「スカイサーカス」=この番「とりつかい」を使っていればワザのエネルギーが0／ワザ「かぜのつぶて」ベンチに60。',
    '駒屋アキラによる色違いモクロー。かわいい系の色違いで、S帯では上位の相場。'],
  ['221', 'S', 'スイクン', 'suicune', '水', 'たね', 120, 'Kagemaru Himeno', 'high', 'high', 'normal', 'low',
    'ワザ「スプラッシュ」20／「オーロラループ」130（水エネ2個を手札に戻す）。',
    '姫野かげまるによる色違いスイクン。旧世代から続く人気絵師＋伝説ポケモンで、S帯の最高額枠。'],
  ['238', 'S', 'ワンパチ', 'yamper', '雷', 'たね', 70, 'sowsow', 'high', 'mid', 'normal', 'none',
    'ワザ「ほえる」=相手のバトルポケモンを入れ替え／「バチバチ」10。',
    'sowsow による色違いワンパチ。作家人気でS帯の中位以上を維持している。'],

  // ── SSR（色違いスーパーレア）307-324 ─────────────────────────
  ['307', 'SSR', 'リザードンV', 'charizard-v', '炎', 'たね', 220, '5ban Graphics', 'high', 'high', 'scarce', 'mid',
    'ワザ「ツメできりさく」80／「ほのおのうず」220（エネを2個トラッシュ）。',
    '色違い（黒）リザードンVのSSR。通常版が存在せずこの弾でしか手に入らないため、VMAX(308)に次ぐチェイス。'],
  ['308', 'SSR', 'リザードンVMAX', 'charizard-vmax', '炎', 'VMAX', 330, 'aky CG Works', 'high', 'high', 'scarce', 'mid',
    'ワザ「ツメできりさく」100／「キョダイゴクエン」300（エネを2個トラッシュ）。',
    '色違い（黒）リザードンVMAXのSSR。シャイニースターVの看板であり最高額カード。剣盾期の色違いリザードンとして長期的に堅い。'],
  ['311', 'SSR', 'ラプラスV', 'lapras-v', '水', 'たね', 210, '5ban Graphics', 'mid', 'mid', 'normal', 'mid',
    'ワザ「ウェーブバック」=水エネをつけてベンチと入れ替え／「オーシャンループ」210（水エネ2個を手札に戻す）。',
    '色違いラプラスVのSSR。ラプラスVMAX(312)と対になるが、V側はSSR帯では下位寄りの相場。'],
  ['312', 'SSR', 'ラプラスVMAX', 'lapras-vmax', '水', 'VMAX', 320, '5ban Graphics', 'mid', 'high', 'normal', 'mid',
    'ワザ「キョダイポンプ」=ついている水エネの数×30ダメージ追加。',
    '色違いラプラスVMAXのSSR。ラプラスは知名度が高く、リザードン・メタモンに次ぐSSR帯の中位。'],
  ['323', 'SSR', 'メタモンV', 'ditto-v', '無', 'たね', 170, 'Saki Hayashiro', 'mid', 'high', 'normal', 'mid',
    '特性「Vへんげ」=トラッシュのたねポケモンVと入れ替わる／ワザ「ペタッとつく」。',
    '色違いメタモンVのSSR。メタモンの色違いは青みがかった配色で人気があり、SSR帯の中位以上。'],
  ['324', 'SSR', 'メタモンVMAX', 'ditto-vmax', '無', 'VMAX', 320, 'PLANETA Tsuji', 'mid', 'high', 'normal', 'mid',
    'ワザ「ダイヘンシン」=相手のバトルポケモンのワザを1つ選んでこのワザとして使う。',
    '色違いメタモンVMAXのSSR。リザードンを除けばこの弾のSSR最高額で、ネタ性の高い変身ギミックも人気。'],

  // ── UR 327-330（limitless非収録・TCGplayer CDN画像）────────────
  ['327', 'UR', 'ムゲンダイナV', 'eternatus-v', '悪', 'たね', 220, '5ban Graphics', 'mid', 'mid', 'normal', 'mid',
    'ワザ「パワーアクセラレーター」30＋ベンチに悪エネ加速／「ダイナマックスほう」120＋相手がVMAXなら120追加。',
    'ゴールド仕様のUR。剣盾の看板伝説だがUR帯では中位の相場。'],
  ['328', 'UR', 'ムゲンダイナVMAX', 'eternatus-vmax', '悪', 'VMAX', 340, '5ban Graphics', 'mid', 'mid', 'normal', 'high',
    '特性「ムゲンゾーン」=全員が悪ならベンチを8匹に／ワザ「ドレッドエンド」=悪ポケモンの数×30。',
    'ゴールド仕様のUR。剣盾期に環境を席巻したデッキの中心で、実需の記憶からUR帯の中位以上。'],
  ['329', 'UR', 'ザシアンV', 'zacian-v', '鋼', 'たね', 220, '5ban Graphics', 'mid', 'high', 'normal', 'high',
    '特性「ふとうのつるぎ」=山札の上3枚から鋼エネを加速／ワザ「ブレイブキャリバー」230。',
    'ゴールド仕様のUR。剣盾期を代表する強力カードで、この弾のUR最高額。'],
  ['330', 'UR', 'ザマゼンタV', 'zamazenta-v', '鋼', 'たね', 230, 'aky CG Works', 'mid', 'high', 'normal', 'mid',
    '特性「ふくつのたて」=ポケモンVMAXのワザのダメージを受けない／ワザ「アサルトタックル」130。',
    'ゴールド仕様のUR。ザシアン(329)と対になる伝説で、UR帯の中位。'],
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
      player: { regulation_mark: 'D', rotation: 'far', competitive_usage: usage },
      collector: { illustrator: illus, illustrator_popularity: illusPop, artwork_type: 'original', rarity },
      common: { reprint_status: 'none', scarcity, character_popularity: charPop },
    },
    evidence_notes: {
      player: '',
      collector: colNote,
      source: 'limitlesstcg.com/cards/jp/S4a/{番号}（UR 327-330 は serebii.net/card/shinystarv/{番号}.shtml）で名称・番号・HP・タイプ・ステージ・イラストレーターを1枚ずつ確認（2026-08-19）',
    },
    note: '',
  })
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`${BOX}: ${before} -> ${ROWS.length} 枚（合計 ${data.cards.length} 枚 / ${data.boxes.length} box）`)
const ids = data.cards.map((c) => c.id)
const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
console.log(dup.length ? `⚠️ 重複ID: ${dup.join(', ')}` : 'ID重複なし')
