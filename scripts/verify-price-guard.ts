/**
 * guardPrice の回帰テスト。ネットワーク不要・数秒で終わる。
 *
 * 【このファイルの目的】
 * 「価格の取得がおかしい」は同じ種類の事故が経路を変えて何度も再発してきた。原因は、
 * 修正が毎回その時の経路への場当たり対応で、**過去の事故が二度と通らないことを
 * 機械的に確かめる仕組みが無かった**こと。ここに実際に起きた事故の実データを
 * ケースとして積み、CI で毎回再生する。
 *
 * 【運用ルール】
 * 価格の不具合を1件直したら、必ずここに1ケース足してから閉じること。
 * 実行: npx tsx scripts/verify-price-guard.ts
 */
import { guardPrice, matchesCardName } from './scrape-prices'
import type { PriceRecord, PriceSource } from '../src/types/pokeca'

type OnSale = { count: number | null; askLow: number | null; askMid: number | null }

interface Case {
  name: string
  /** true = 関門が弾くべき（＝過去に事故になった値） / false = 通すべき（誤爆させてはいけない値） */
  shouldReject: boolean
  id: string
  date: string
  avg: number
  low?: number
  high?: number
  priceSource: PriceSource
  onSale: OnSale | null
  prev: Partial<PriceRecord> | null
  /** 採用した成約件数。R5（薄いサンプルを採らない）を再生するケースで指定する */
  sampleCount?: number
}

const cases: Case[] = [
  // ── 実際に起きた事故（弾くべき） ──────────────────────────────
  {
    name: 'メガルチャブルex MA: スニダン床値¥1,517 がスニダン主経路から流入（2026-07-31・実勢¥561）',
    shouldReject: true,
    id: 'mega-dream-ex-mega-ruchaburu-ex-ma',
    date: '2026-07-31',
    avg: 1517,
    priceSource: 'snkrdunk',
    onSale: { count: 30, askLow: 499, askMid: 739 },
    prev: { date: '2026-07-30', avg: 561, ask_low: 499, ask_mid: 739 },
  },
  {
    name: 'メガズルズキンex MA: 同じ床値張り付き（実勢¥927 → ¥1,533）',
    shouldReject: true,
    id: 'mega-dream-ex-mega-zuruuzukin-ex-ma',
    date: '2026-07-31',
    avg: 1533,
    priceSource: 'snkrdunk',
    onSale: { count: 20, askLow: 480, askMid: 700 },
    prev: { date: '2026-07-28', avg: 927, ask_low: 480, ask_mid: 700 },
  },
  {
    name: '蒼空ストリームBOX(シュリンクあり): 成約が薄く検索窓が90日超に拡張され古い高値が混入(+61%)',
    shouldReject: true,
    id: 'box-soukuu_stream-shrink',
    date: '2026-08-01',
    avg: 258334,
    priceSource: 'mercari',
    onSale: { count: 12, askLow: null, askMid: null },
    prev: { date: '2026-07-31', avg: 160573 },
  },
  {
    name: 'ブラックボルトBOX(シュリンクあり): 上限¥43,000の混入で+44%、シュリンクなし¥21,426は据え置き',
    shouldReject: true,
    id: 'box-black_bolt-shrink',
    date: '2026-07-30',
    avg: 33754,
    priceSource: 'mercari',
    onSale: { count: 40, askLow: null, askMid: null },
    prev: { date: '2026-07-29', avg: 23500 },
  },
  {
    name: 'カイリューV SR: SA版(¥50,000超)が「SR」表記で混入し多数派化（2026-07-27）',
    shouldReject: true,
    id: 'soukuu-stream-kairyu-v-sr-73',
    date: '2026-07-27',
    avg: 44345,
    priceSource: 'mercari',
    onSale: { count: 60, askLow: 2800, askMid: 3400 },
    prev: { date: '2026-07-26', avg: 3153, ask_low: 2800, ask_mid: 3400 },
  },
  {
    name: 'レックウザVMAX SA: 番号無しHR出品が混ざり成約avgが出品最安より安くなる矛盾（2026-07-29）',
    shouldReject: true,
    id: 'soukuu-stream-rayquaza-vmax-sa-hr-83',
    date: '2026-07-29',
    avg: 343633,
    priceSource: 'mercari',
    onSale: { count: 8, askLow: 499999, askMid: 900000 },
    prev: { date: '2026-07-28', avg: 614094, ask_low: 499999, ask_mid: 900000 },
  },
  {
    name: 'latias&latios GX SR: 出所が1日だけ反転した孤立ヒゲ ¥14,800→¥64,735（2026-07-23）',
    shouldReject: true,
    id: 'tag-bolt-latias-latios-gx-sr-104',
    date: '2026-07-23',
    avg: 64735,
    priceSource: 'mercari',
    onSale: { count: 15, askLow: 13000, askMid: 16000 },
    prev: { date: '2026-07-22', avg: 14800, ask_low: 13000, ask_mid: 16000 },
  },
  {
    name: 'ブラッキーV SR: メルカリ誤マッチの鑑定品混入プラトー ¥45,000（実勢¥8,632）',
    shouldReject: true,
    id: 'eevee-heroes-burakkii-v-sr-84',
    date: '2026-07-22',
    avg: 45000,
    priceSource: 'mercari',
    onSale: { count: 25, askLow: 8000, askMid: 15000 },
    prev: { date: '2026-07-21', avg: 8632, ask_low: 8000, ask_mid: 15000 },
  },

  // ── 誤爆させてはいけない値（通すべき） ────────────────────────
  {
    name: '正常: スニダン美品がメルカリ出品より高いのは設計通り（高額帯・ポケセンピカチュウ）',
    shouldReject: false,
    id: 'pokecen-pikachu-tohoku',
    date: '2026-07-31',
    avg: 14913,
    priceSource: 'snkrdunk',
    onSale: { count: 40, askLow: 1380, askMid: 5000 },
    prev: { date: '2026-07-30', avg: 14800, ask_low: 1380, ask_mid: 5000 },
  },
  {
    name: '正常: グレイシアVMAX SA は ask_low¥2,200 が投げ売り1件。ask_mid¥83,750 とは整合',
    shouldReject: false,
    id: 'eevee-heroes-gureishia-vmax-sa-91',
    date: '2026-07-31',
    avg: 72908,
    priceSource: 'mercari',
    onSale: { count: 21, askLow: 2200, askMid: 83750 },
    prev: { date: '2026-07-30', avg: 72473, ask_low: 2200, ask_mid: 89999 },
  },
  {
    name: '正常: 出品価格が同方向に動いた急騰は本物の相場変動として通す',
    shouldReject: false,
    id: 'some-card-sar',
    date: '2026-07-31',
    avg: 15000,
    priceSource: 'mercari',
    onSale: { count: 30, askLow: 12000, askMid: 16000 },
    prev: { date: '2026-07-30', avg: 10000, ask_low: 8000, ask_mid: 11000 },
  },
  {
    name: '正常: 新規カード（前日レコード無し・ask無し）は初日から記録できる',
    shouldReject: false,
    id: 'storm-emeralda-new-card-sr',
    date: '2026-07-31',
    avg: 3200,
    priceSource: 'mercari',
    onSale: { count: null, askLow: null, askMid: null },
    prev: null,
  },
  {
    // 2026-08-06 の再発。08-02以降ずっと棄却され続けた結果 prev が4日前になり、
    // **R0 が R3 を飛ばして** 2026-08-01 と同じ事故（+61%）が通った。
    // 関門の棄却そのものが R0 の入口を開けるので、整合性系のルールは免除してはいけない。
    name: '蒼空ストリームBOX(シュリンクあり): 4日棄却され続けた後に同じ高値が R0 経由で通った再発',
    shouldReject: true,
    id: 'box-soukuu_stream-shrink',
    date: '2026-08-06',
    avg: 258750,
    low: 232500,
    high: 285000,
    priceSource: 'mercari',
    onSale: { count: 10, askLow: null, askMid: null },
    prev: { date: '2026-08-02', avg: 160573 },
  },
  {
    // 2026-08-13 にシュリンク分離を直した結果、絶版弾では「あり/なし」が本当に2.6倍離れる
    // ことが見えるようになった。上の事故(2.53倍)より比は大きいので、比率だけでは分離できない。
    // 事故は前日比+61%で突然跳ねる／こちらは毎日同じ水準で居座る、が分かれ目。
    name: '正常: イーブイヒーローズBOX(シュリンクあり) 絶版弾の2.64倍プレミアムは前日から安定していれば通す',
    shouldReject: false,
    id: 'box-eevee_heroes-shrink',
    date: '2026-08-13',
    avg: 137500,
    low: 130000,
    high: 145000,
    priceSource: 'mercari',
    onSale: { count: 8, askLow: null, askMid: null },
    prev: { date: '2026-08-12', avg: 133722 },
  },
  {
    name: '正常: 4日以上更新できていない銘柄は裏付け無しでも受け入れる（価格の凍り付き防止）',
    shouldReject: false,
    id: 'frozen-card-sr',
    date: '2026-07-31',
    avg: 5000,
    priceSource: 'mercari',
    onSale: { count: 10, askLow: 4000, askMid: 5200 },
    prev: { date: '2026-07-25', avg: 2000, ask_low: 4000, ask_mid: 5200 },
  },
  {
    name: 'ニンフィアVMAX SA: avg は妥当でも帯が ¥30,000〜¥142,000 に崩れた（出品最安¥149,999・n=15→5）',
    shouldReject: true,
    id: 'eevee-heroes-ninfia-vmax-sa-93',
    date: '2026-08-03',
    avg: 133500,
    low: 30000,
    high: 142000,
    priceSource: 'mercari',
    onSale: { count: 20, askLow: 149999, askMid: 188888 },
    prev: { date: '2026-08-02', avg: 116200, ask_low: 149999, ask_mid: 188888 },
  },
  {
    name: 'オーロットVMAX HR: n=4 で帯が ¥333〜¥5,733（17.2倍）に崩れた',
    shouldReject: true,
    id: 'soukuu-stream-aurott-vmax-hr-80',
    date: '2026-08-03',
    avg: 3985,
    low: 333,
    high: 5733,
    priceSource: 'mercari',
    onSale: { count: 3, askLow: null, askMid: null },
    prev: { date: '2026-08-02', avg: 3985 },
  },
  {
    // 2026-08-04 の再発。R4 を足した直後なのに同じ値が入り直した。
    // 汚染レコード(08-01〜08-03)をデータ掃除で削除したせいで prev が 07-31＝4日前になり、
    // **R0(凍り付き防止)が先に true を返して R4 を飛ばした**のが原因。掃除で空けた穴が
    // そのまま抜け道になる、という関門の順序の問題。R4 は R0 より前で判定すること。
    name: 'オーロットVMAX HR: 前回が4日前でも壊れた帯は通さない（R0がR4を飛ばしてはいけない）',
    shouldReject: true,
    id: 'soukuu-stream-aurott-vmax-hr-80',
    date: '2026-08-04',
    avg: 3985,
    low: 333,
    high: 5733,
    priceSource: 'mercari',
    onSale: { count: 1, askLow: null, askMid: null },
    prev: { date: '2026-07-31', avg: 5811 },
  },
  {
    name: '正常: 前回が4日前でも帯が健全なら受け入れる（R4を足してもR0の逃げ道は残る）',
    shouldReject: false,
    id: 'frozen-card-with-sane-band-sr',
    date: '2026-07-31',
    avg: 5000,
    low: 4200,
    high: 5800,
    priceSource: 'mercari',
    onSale: { count: 10, askLow: 4000, askMid: 5200 },
    prev: { date: '2026-07-25', avg: 2000, ask_low: 4000, ask_mid: 5200 },
  },

  // 2026-08-03: 「PSA10/素体の倍率が同格から外れる」で異常を疑ったが、メルカリ成約を実際に
  // 見に行くと**どちらも実勢どおりだった**。安いカードは鑑定料(数千円)が下限になるので
  // PSA10倍率が15〜25倍に開くのは正常。倍率だけで異常と判定してはいけない、の証拠として残す。
  {
    name: '正常: マチスの取引SAR ¥611（実市場 ¥450〜900 を確認済。PSA10比15倍は鑑定料の下限効果）',
    shouldReject: false,
    id: 'mega-brave-matis-no-torihiki-sar',
    date: '2026-08-02',
    avg: 611,
    priceSource: 'mercari',
    onSale: { count: 120, askLow: 666, askMid: 850 },
    prev: { date: '2026-08-01', avg: 606, ask_low: 688, ask_mid: 860 },
  },
  {
    name: '正常: サーファーSAR ¥660（実市場 ¥444〜800 を確認済）',
    shouldReject: false,
    id: 'mega-dream-ex-saafaa-sar',
    date: '2026-08-02',
    avg: 660,
    priceSource: 'mercari',
    onSale: { count: 150, askLow: 700, askMid: 900 },
    prev: { date: '2026-08-01', avg: 655, ask_low: 700, ask_mid: 900 },
  },
  {
    name: '正常: BOX統合ファイルは出品プールを広く取るため ask 乖離では弾かない',
    shouldReject: false,
    id: 'box-storm_emeralda',
    date: '2026-07-31',
    avg: 20500,
    priceSource: 'mercari',
    onSale: { count: 50, askLow: 8250, askMid: 8300 },
    prev: null,
  },

  // ── 薄商いで日が空き、R0 が出所切替の段差を通した事故（2026-08-19） ────────
  // ラティアス&ラティオスGX SA。スニダン n=2 の ¥515,000 が3日分入ったあと9日空き、
  // 次にメルカリが取れた日に -61% の崖がグラフに刻まれた。前日レコードがあれば R2 が
  // 「出品価格が追随せず」で弾いていた値。R0 は ask が汚れた銘柄(R1)を救うための逃げ道で
  // あって、出所が変わった日の前日比(R2)まで免除してよいものではない。
  {
    name: 'ラティアス&ラティオスGX SA: 9日空き＋スニダン→メルカリの出所切替で-61%（R0がR2を飛ばしてはいけない）',
    shouldReject: true,
    id: 'tag-bolt-latias-latios-gx-sa-105',
    date: '2026-08-19',
    avg: 202625,
    low: 139800,
    high: 300000,
    priceSource: 'mercari',
    sampleCount: 9,
    onSale: { count: 20, askLow: 183333, askMid: 400000 },
    prev: { date: '2026-08-10', avg: 515000, source: 'snkrdunk', sample_count: 2, ask_low: 91000, ask_mid: 428250 },
  },
  {
    name: 'ラティアス&ラティオスGX SA: その段差の元になった n=2 のスニダン値¥515,000（R5・出品最安は¥91,000）',
    shouldReject: true,
    id: 'tag-bolt-latias-latios-gx-sa-105',
    date: '2026-08-08',
    avg: 515000,
    low: 463500,
    high: 566500,
    priceSource: 'snkrdunk',
    sampleCount: 2,
    onSale: { count: 23, askLow: 93000, askMid: 428250 },
    prev: { date: '2026-07-29', avg: 405000, source: 'snkrdunk', sample_count: 2, ask_low: 350000, ask_mid: 530000 },
  },
  {
    name: '正常: 出所が同じなら4日空きの前日比免除(R0)はこれまで通り効く',
    shouldReject: false,
    id: 'tag-bolt-latias-latios-gx-sr-104',
    date: '2026-08-19',
    avg: 6771,
    low: 6000,
    high: 7000,
    priceSource: 'mercari',
    sampleCount: 24,
    onSale: { count: 25, askLow: 8700, askMid: 9999 },
    prev: { date: '2026-08-14', avg: 9800, source: 'mercari', sample_count: 20, ask_low: 8700, ask_mid: 9999 },
  },
  {
    name: '正常: 出所が変わっても2週間を超えて更新できていなければ受け入れる（凍り付き防止）',
    shouldReject: false,
    id: 'tag-bolt-latias-latios-gx-sa-105',
    date: '2026-08-26',
    avg: 217300,
    low: 139800,
    high: 300000,
    priceSource: 'mercari',
    sampleCount: 13,
    onSale: { count: 20, askLow: 145000, askMid: 410000 },
    prev: { date: '2026-07-28', avg: 346944, source: 'snkrdunk', sample_count: 4, ask_low: 350000, ask_mid: 530000 },
  },
  {
    name: '正常: 出所切替でも出品中央値が新しい水準を裏付けていれば通す（ミュウex UR型の正常な切替）',
    shouldReject: false,
    id: 'mew-ex-ur-dummy',
    date: '2026-08-19',
    avg: 12970,
    low: 11000,
    high: 14500,
    priceSource: 'snkrdunk',
    sampleCount: 17,
    onSale: { count: 40, askLow: 9800, askMid: 11111 },
    prev: { date: '2026-08-12', avg: 7936, source: 'mercari', sample_count: 15, ask_low: 9500, ask_mid: 10800 },
  },
]

let failed = 0
for (const c of cases) {
  const verdict = guardPrice({
    id: c.id,
    date: c.date,
    avg: c.avg,
    low: c.low,
    high: c.high,
    priceSource: c.priceSource,
    onSale: c.onSale as never,
    prev: c.prev as PriceRecord | null,
    sampleCount: c.sampleCount,
  })
  const rejected = !verdict.ok
  const pass = rejected === c.shouldReject
  if (!pass) failed++
  const mark = pass ? '  OK  ' : ' NG!! '
  const detail = rejected ? `弾いた（${(verdict as { reason: string }).reason}）` : '通した'
  console.log(`${mark} [${c.shouldReject ? '弾くべき' : '通すべき'}] ${c.name}\n         → ${detail}`)
}

console.log(`\n${cases.length - failed}/${cases.length} 件パス`)

// ── 採用するタイトルがそもそもこのカードか（matchesCardName） ─────────────
// メルカリの検索は完全一致が少ないと勝手に条件を緩めて別カードを返す。関門(guardPrice)は
// 「入ってきた数字」しか見られないので、ここで**採用前**に落とすしかない。
console.log('\n── タイトルの名前照合（検索が緩んで別カードが返る事故） ──')
const nameCases: Array<{ title: string; name: string; want: boolean; note?: string }> = [
  // 2026-08-06 ユーザー報告「おすすめカードのオーロットの値段がおかしい」の実データ。
  // 検索「オーロットVMAX HR 蒼空ストリーム」が返した4件のうち本物は1件だけだった。
  { title: 'オーロットVMAX HR S7R 蒼空ストリーム 080/067', name: 'オーロットVMAX', want: true },
  { title: '状態B オーロットVMAX s7R E 080/067 HR ★ ポケカ', name: 'オーロットVMAX', want: true },
  { title: '080/067/S7R/B/HR オーロットVMAX', name: 'オーロットVMAX', want: true },
  { title: 'メガリザードンex SR インフェルノX', name: 'オーロットVMAX', want: false },
  { title: 'ポケモンカードex マリィのオーロンゲex', name: 'オーロットVMAX', want: false },
  // 誤爆させてはいけない表記ゆれ（全角・分かち書き・大小文字）
  { title: 'リーフィア Ｖ SR 070/069', name: 'リーフィアV', want: true },
  { title: 'ヒガナ 決意 SR 蒼空ストリーム', name: 'ヒガナの決意', want: true },
  { title: 'Ｎのゾロアークex SAR', name: 'Nのゾロアークex', want: true },
  { title: 'ラティアス＆ラティオスGX SA 105/095', name: 'ラティアス&ラティオスGX', want: true },
  { title: 'トウホク ピカチュウ プロモ 260/SV-P', name: 'トウホクのピカチュウ', want: true },
  { title: 'ブラッキーVMAX SA 095/069', name: 'リーフィアV', want: false },
  // 既知の限界: TAG TEAM 名を逆順で書いた出品は落ちる（採らないだけなので安全側）
  { title: 'ラティオス&ラティアス GX SR', name: 'ラティアス&ラティオスGX', want: false, note: '既知の限界' },
]
let nameFailed = 0
for (const c of nameCases) {
  const got = matchesCardName(c.title, c.name)
  const pass = got === c.want
  if (!pass) nameFailed++
  console.log(`${pass ? '  OK  ' : ' NG!! '} [${c.name}] ${c.title} → ${got ? '採用' : '不採用'}${c.note ? `（${c.note}）` : ''}`)
}
console.log(`\n${nameCases.length - nameFailed}/${nameCases.length} 件パス`)

if (failed > 0 || nameFailed > 0) {
  console.error(`\n❌ ${failed + nameFailed}件が期待と違う。guardPrice / matchesCardName を直すか、期待値の根拠を再確認すること。`)
  process.exit(1)
}
console.log('✅ 過去の事故はすべて関門で止まる')
