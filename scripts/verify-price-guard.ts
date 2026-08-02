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
import { guardPrice } from './scrape-prices'
import type { PriceRecord, PriceSource } from '../src/types/pokeca'

type OnSale = { count: number | null; askLow: number | null; askMid: number | null }

interface Case {
  name: string
  /** true = 関門が弾くべき（＝過去に事故になった値） / false = 通すべき（誤爆させてはいけない値） */
  shouldReject: boolean
  id: string
  date: string
  avg: number
  priceSource: PriceSource
  onSale: OnSale | null
  prev: Partial<PriceRecord> | null
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
    name: '正常: BOX統合ファイルは出品プールを広く取るため ask 乖離では弾かない',
    shouldReject: false,
    id: 'box-storm_emeralda',
    date: '2026-07-31',
    avg: 20500,
    priceSource: 'mercari',
    onSale: { count: 50, askLow: 8250, askMid: 8300 },
    prev: null,
  },
]

let failed = 0
for (const c of cases) {
  const verdict = guardPrice({
    id: c.id,
    date: c.date,
    avg: c.avg,
    priceSource: c.priceSource,
    onSale: c.onSale as never,
    prev: c.prev as PriceRecord | null,
  })
  const rejected = !verdict.ok
  const pass = rejected === c.shouldReject
  if (!pass) failed++
  const mark = pass ? '  OK  ' : ' NG!! '
  const detail = rejected ? `弾いた（${(verdict as { reason: string }).reason}）` : '通した'
  console.log(`${mark} [${c.shouldReject ? '弾くべき' : '通すべき'}] ${c.name}\n         → ${detail}`)
}

console.log(`\n${cases.length - failed}/${cases.length} 件パス`)
if (failed > 0) {
  console.error(`\n❌ ${failed}件が期待と違う。guardPrice を直すか、期待値の根拠を再確認すること。`)
  process.exit(1)
}
console.log('✅ 過去の事故はすべて関門で止まる')
