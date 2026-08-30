// ハイクラスパック GXウルトラシャイニー（SM8b・2018-11-02発売）の高額チェイス17枚を追加する。
// カード名/番号/HP/タイプ/ステージ/イラストレーターは limitlesstcg.com/cards/jp/SM8b/{番号} で1枚ずつ確認（2026-08-30）。
//
// ⚠ UR(244-250)は入れていない。limitless が SM8b を 243 までしか持っておらず（CDN 403・カードページも404）、
//   買取も¥500〜2,000と薄商い帯なので、S8b/S4a の時のような TCGplayer CDN 迂回を割に合わせられない。
// 選定基準＝遊々亭の買取一覧（yuyu-tei.jp/buy/poc/s/sm08b）とポケカジラの販売一覧の高額帯。
// スニダンの素体成約はこの弾では45日で0〜2件しかなく、価格は全枚数メルカリから入る見込み
// （PSA10はスニダンから取れる）。scrape-prices.ts の閾値6件がそのまま効く。
import fs from 'node:fs'

const DATA = 'C:/Users/user/Desktop/pokeca-souba/data/pokeca_data.json'
const BOX = 'gx_ultra_shiny'
const PREFIX = 'gx-ultra-shiny'
const TOTAL = '150'

const img = (n) => `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/SM8b/SM8b_${n}_R_JP_LG.png`

const BOX_ENTRY = {
  box_id: BOX,
  box_name: 'GXウルトラシャイニー',
  code: 'SM8b',
  release_ym: '2018-11',
  certainty: 'released',
  pack_price_yen: 540,
  packs_per_box: 10,
  pack_image_url: 'https://archives.bulbagarden.net/media/upload/d/d1/SM8b_GX_Ultra_Shiny_pack.jpg',
  note: '2018-11-02発売のハイクラスパック（希望小売価格500円＋税・1パック10枚・1BOX10パック）。通常150種＋シークレット94種の全244種で、色違いポケモン83種を収録したサン&ムーン期の総集編。目玉は色違いGXのSSRで、リザードンGX・レックウザGX・ブラッキーGXの3枚が突出して高い。長期絶版でBOX相場は定価の約30倍。',
}

// [番号, レアリティ, カード名, slug, タイプ, ステージ, HP, イラストレーター, 絵師人気, キャラ人気, 競技採用, spec備考, collector備考]
const ROWS = [
  // ── SSR（色違いGXのフルアート）209-240 ──────────────────────
  ['209', 'SSR', 'リザードンGX', 'charizard-gx', '炎', '2進化', 250, '5ban Graphics', 'mid', 'high', 'none',
    'ワザ「つばさでうつ」70／「ぐれんのあらし」300（炎エネを3個トラッシュ）／「レイジングアウトGX」=相手の山札を上から10枚トラッシュ。',
    'この弾の単独トップ。色違いリザードンGXのSSRで、GX期を通じても最高額帯のカード。買取¥90,000・販売¥188,000前後。PSA10は2,870枚（鑑定総数5,153枚）。'],
  ['240', 'SSR', 'レックウザGX', 'rayquaza-gx', '竜', 'たね', 180, '5ban Graphics', 'mid', 'high', 'none',
    '色違いレックウザGXのフルアート。ワザ「ドラゴンブレス」／「エメラルドブレイクGX」。',
    'リザードンGXに次ぐこの弾の第2チェイス。買取¥80,000前後。レックウザは色違い人気が特に厚い。PSA10は1,773枚。'],
  ['229', 'SSR', 'ブラッキーGX', 'umbreon-gx', '悪', '1進化', 200, '5ban Graphics', 'mid', 'high', 'none',
    'ワザ「ひるがえす」30／「シャドーバレット」90。色違いブラッキーGXのフルアート。',
    '第3チェイス。買取¥40,000前後。イーブイズの中でもブラッキーは突出して人気が高く、剣盾期のブラッキーVMAX CSRと同じ構図の需要。PSA10は2,049枚。'],
  ['216', 'SSR', 'ゲッコウガGX', 'greninja-gx', '水', '2進化', 230, '5ban Graphics', 'mid', 'high', 'none',
    'ワザ「おぼろぎり」110。色違いゲッコウガGXのフルアート。',
    '買取¥12,500前後。ゲッコウガは海外人気も厚い銘柄。PSA10は454枚と鑑定数が少なく、SSR帯では希少。'],
  ['219', 'SSR', 'ミュウツーGX', 'mewtwo-gx', '超', 'たね', 190, '5ban Graphics', 'mid', 'high', 'none',
    'ワザ「ちょうきゅうしゅう」60／「サイコブレイクGX」200。色違いミュウツーGXのフルアート。',
    '買取¥12,500前後。ミュウツーは初代からの定番人気でコレクター需要が安定している。PSA10は2,146枚。'],
  ['238', 'SSR', 'ニンフィアGX', 'sylveon-gx', 'フェアリー', '1進化', 200, '5ban Graphics', 'mid', 'high', 'none',
    'ワザ「ようせいのかぜ」110。色違いニンフィアGXのフルアート。',
    '買取¥12,000前後。イーブイズの中でブラッキーに次ぐ人気。PSA10は1,957枚。'],
  ['230', 'SSR', 'ダークライGX', 'darkrai-gx', '悪', 'たね', 180, '5ban Graphics', 'mid', 'high', 'none',
    'ワザ「やみのさけめ」130。色違いダークライGXのフルアート。',
    '買取¥10,000前後。PSA10は440枚と鑑定数が少ない。'],
  ['220', 'SSR', 'エーフィGX', 'espeon-gx', '超', '1進化', 200, '5ban Graphics', 'mid', 'high', 'none',
    'ワザ「サイケこうせん」30。色違いエーフィGXのフルアート。',
    '買取¥8,000前後。ブラッキー(229)と対になるイーブイズSSR。PSA10は1,091枚。'],
  ['224', 'SSR', 'ルカリオGX', 'lucario-gx', '闘', '1進化', 210, '5ban Graphics', 'mid', 'high', 'none',
    'ワザ「せんぷうきゃく」130。色違いルカリオGXのフルアート。',
    '買取¥6,000前後。PSA10は343枚とこの17枚で最も鑑定数が少ない。'],
  ['210', 'SSR', 'ホウオウGX', 'hooh-gx', '炎', 'たね', 190, '5ban Graphics', 'mid', 'mid', 'none',
    'ワザ「フェニックスバーン」180。色違いホウオウGXのフルアート。',
    '買取¥5,500前後。伝説枠のSSRとして中位。PSA10は989枚。'],
  ['211', 'SSR', 'レシラムGX', 'reshiram-gx', '炎', 'たね', 180, 'PLANETA Igarashi', 'mid', 'mid', 'none',
    'ワザ「しゃくねつのはしら」110／「ヴァーミリオンGX」180。色違いレシラムGXのフルアート。',
    '買取¥5,500前後。この弾で唯一 PLANETA Igarashi が描いたSSR。PSA10は923枚。'],
  ['206', 'SSR', 'リーフィアGX', 'leafeon-gx', '草', '1進化', 200, '5ban Graphics', 'mid', 'mid', 'none',
    'ワザ「ソーラービーム」110。色違いリーフィアGXのフルアート。',
    '買取¥4,500前後。イーブイズSSRの中では中位だが、8枚揃えるコレクター需要が下支えする。PSA10は831枚。'],
  ['215', 'SSR', 'グレイシアGX', 'glaceon-gx', '水', '1進化', 200, '5ban Graphics', 'mid', 'mid', 'none',
    'ワザ「フロストバレット」90。色違いグレイシアGXのフルアート。',
    '買取¥3,000前後。リーフィア(206)と対になるイーブイズSSR。PSA10は1,406枚。'],
  ['237', 'SSR', 'サーナイトGX', 'gardevoir-gx', 'フェアリー', '2進化', 230, '5ban Graphics', 'mid', 'high', 'none',
    '色違いサーナイトGXのフルアート。SM期のサーナイトGXは環境デッキの主軸だった。',
    '買取¥2,400前後。競技人気の高かったカードの色違い版。PSA10は855枚。'],

  // ── SR（トレーナー）152-153 ─────────────────────────────────
  ['153', 'SR', 'シロナ', 'cynthia', 'サポート', 'サポート', 0, 'Yusuke Ohmura', 'high', 'high', 'none',
    'サポート。手札を全て山札に戻してシャッフルし、6枚引く。SM期の必須ドローサポート。',
    'SSRを除けばこの弾のトップ。買取¥12,000前後。大村祐介によるシロナで、女性キャラSRの代表格。PSA10は4,282枚とこの弾で最も鑑定されているカード。'],
  ['152', 'SR', 'グズマ', 'guzma', 'サポート', 'サポート', 0, 'Hitoshi Ariga', 'mid', 'mid', 'none',
    'サポート。相手のベンチポケモンとバトルポケモンを入れ替え、自分も入れ替える。SM期の定番サポート。',
    '買取¥2,000前後。有賀ヒトシによるグズマ。PSA10は384枚と鑑定数が少ない。'],

  // ── S（色違いレア）201 ──────────────────────────────────────
  ['201', 'S', 'イーブイ', 'eevee', '無', 'たね', 60, 'kirisAki', 'high', 'high', 'none',
    '色違いイーブイ。GX/SSRではない通常の色違いレア（S）だが、この弾のS帯では突出した相場。',
    '販売¥9,980前後とS帯の最高額。kirisAki のイーブイでイラスト人気が高く、イーブイズを集める層が必ず通る1枚。PSA10は1,114枚。'],
]

const data = JSON.parse(fs.readFileSync(DATA, 'utf-8'))

const bi = data.boxes.findIndex((b) => b.box_id === BOX)
if (bi >= 0) data.boxes[bi] = BOX_ENTRY
else data.boxes.push(BOX_ENTRY)

const before = data.cards.filter((c) => c.box_id === BOX).length
data.cards = data.cards.filter((c) => c.box_id !== BOX)

for (const [no, rarity, name, slug, type, stage, hp, illus, illusPop, charPop, usage, specNote, colNote] of ROWS) {
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
      // SM期はレギュレーションマーク導入前。現行スタンダードでは使えないので競技採用は none
      player: { regulation_mark: '', rotation: 'unknown', competitive_usage: usage },
      collector: { illustrator: illus, illustrator_popularity: illusPop, artwork_type: 'original', rarity },
      common: { reprint_status: 'none', scarcity: 'out_of_print', character_popularity: charPop },
    },
    evidence_notes: {
      player: '',
      collector: colNote,
      source: 'limitlesstcg.com/cards/jp/SM8b/{番号} で名称・番号・HP・タイプ・ステージ・イラストレーターを1枚ずつ確認、相場は遊々亭(sm08b)買取一覧とポケカジラ販売一覧、PSA枚数は gemrate（2026-08-30）',
    },
    note: '',
  })
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf-8')
console.log(`${BOX}: ${before} -> ${ROWS.length} 枚（合計 ${data.cards.length} 枚 / ${data.boxes.length} box）`)
const ids = data.cards.map((c) => c.id)
const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
console.log(dup.length ? `⚠️ 重複ID: ${dup.join(', ')}` : 'ID重複なし')
