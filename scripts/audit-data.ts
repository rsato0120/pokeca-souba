// 全カード・全BOXのデータ健全性を一括チェック（ネットワーク不要）。
// 使い方: npx tsx scripts/audit-data.ts
import * as fs from 'fs'
import * as path from 'path'
import { getAllCards, getAllBoxes, getCardSlug, getForecast } from '@/lib/data'
import type { PriceHistory, PriceRecord } from '@/types/pokeca'
import { guardPrice } from './scrape-prices'

const pricesDir = path.join(process.cwd(), 'data', 'prices')
const read = (id: string): PriceRecord[] | null => {
  try { return (JSON.parse(fs.readFileSync(path.join(pricesDir, `${id}.json`), 'utf-8')) as PriceHistory).history } catch { return null }
}
const section = (t: string) => console.log(`\n${'='.repeat(72)}\n${t}\n${'='.repeat(72)}`)
const cards = getAllCards()
const boxes = getAllBoxes()
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)

// ── 1. 価格ファイルが無い / 更新が止まっている ──────────────────────
section('1. 価格ファイル欠落・更新停止')
const missing: string[] = []
const stale: string[] = []
for (const c of cards) {
  const h = read(getCardSlug(c))
  if (!h || h.length === 0) { missing.push(`${c.id} (${c.card_name} ${c.rarity})`); continue }
  const days = Math.round((Date.parse(today) - Date.parse(h[0].date)) / 86400e3)
  if (days >= 2) stale.push(`${c.id.padEnd(42)} 最終 ${h[0].date} (${days}日前)`)
}
console.log(`価格ファイル無し: ${missing.length}件`); missing.forEach(m => console.log('  ', m))
console.log(`2日以上更新なし: ${stale.length}件`); stale.slice(0, 20).forEach(m => console.log('  ', m))

// ── 2. 値が何日も凍結（毎日スキップされている疑い） ──────────────────
section('2. 価格が長期間まったく動いていない（毎日スキップの疑い）')
const frozen: Array<{ id: string; days: number; avg: number }> = []
for (const c of cards) {
  const h = read(getCardSlug(c))
  if (!h || h.length < 8) continue
  let n = 0
  while (n < h.length && h[n].avg === h[0].avg) n++
  if (n >= 10) frozen.push({ id: c.id, days: n, avg: h[0].avg ?? 0 })
}
frozen.sort((a, b) => b.days - a.days)
console.log(`10日以上同値: ${frozen.length}件`)
frozen.slice(0, 15).forEach(f => console.log(`   ${f.id.padEnd(42)} ${f.days}日間 ¥${f.avg.toLocaleString()}`))

// ── 3. 成約avg と 出品最安(ask_low) の乖離 ───────────────────────
section('3. 成約avg と 出品最安の乖離（別バージョン混入・鑑定品混入の指標）')
const div: Array<{ id: string; avg: number; ask: number; ratio: number; src?: string }> = []
for (const c of cards) {
  const h = read(getCardSlug(c))
  const r = h?.[0]
  if (!r || r.ask_low == null || !r.avg) continue
  const ratio = r.avg / r.ask_low
  if (ratio > 2.5 || ratio < 0.4) div.push({ id: c.id, avg: r.avg, ask: r.ask_low, ratio, src: r.source })
}
div.sort((a, b) => b.ratio - a.ratio)
console.log(`乖離あり: ${div.length}件`)
div.forEach(d => console.log(`   ${d.id.padEnd(42)} avg ¥${String(d.avg).padStart(8)} / ask ¥${String(d.ask).padStart(8)} = ${d.ratio.toFixed(2)}倍 [${d.src}]`))

// ── 4. PSA10 が素体より安い ─────────────────────────────────
section('4. PSA10 ≦ 素体（鑑定品が素体より安いのは通常あり得ない）')
let psaBad = 0
for (const c of cards) {
  const r = read(getCardSlug(c))?.[0]
  if (!r || r.psa10 == null || !r.avg) continue
  if (r.psa10 <= r.avg) { psaBad++; console.log(`   ${c.id.padEnd(42)} 素体 ¥${r.avg.toLocaleString()} / PSA10 ¥${r.psa10.toLocaleString()} [${r.source}]`) }
}
if (!psaBad) console.log('   なし')

// ── 5. 同名別バージョンの価格逆転・接近 ────────────────────────
section('5. 同名別バージョン（SR⇔SA/SAR/HR）の価格が近すぎる・逆転している')
const RANK: Record<string, number> = { SR: 1, MA: 1, AR: 1, HR: 2, SA: 3, SAR: 3, UR: 3, MUR: 4, BWR: 4 }
const byKey: Record<string, typeof cards> = {}
cards.forEach(c => { const k = `${c.box_id}|${c.card_name}`; (byKey[k] ||= []).push(c) })
for (const [k, cs] of Object.entries(byKey)) {
  if (cs.length < 2) continue
  const rows = cs.map(c => ({ c, r: read(getCardSlug(c))?.[0] })).filter((x): x is { c: typeof cs[0]; r: PriceRecord } => x.r?.avg != null)
  if (rows.length < 2) continue
  rows.sort((a, b) => (RANK[a.c.rarity] ?? 9) - (RANK[b.c.rarity] ?? 9))
  for (let i = 0; i + 1 < rows.length; i++) {
    const lo = rows[i], hi = rows[i + 1]
    if ((RANK[lo.c.rarity] ?? 9) === (RANK[hi.c.rarity] ?? 9)) continue
    const loAvg = lo.r.avg ?? 0, hiAvg = hi.r.avg ?? 0
    if (!loAvg || !hiAvg) continue
    const ratio = hiAvg / loAvg
    if (ratio < 1.6) {
      console.log(`   ${k.padEnd(34)} ${lo.c.rarity}(${lo.c.card_no}) ¥${loAvg.toLocaleString()} [${lo.r.source}]  vs  ${hi.c.rarity}(${hi.c.card_no}) ¥${hiAvg.toLocaleString()} [${hi.r.source}]  = ${ratio.toFixed(2)}倍`)
    }
  }
}

// ── 6. 予想が現在価格と食い違っている ──────────────────────────
section('6. AI予想の current_low/high が実際の価格と乖離（予想の再生成漏れ）')
let fcBad = 0
for (const c of cards) {
  const r = read(getCardSlug(c))?.[0]
  const f = getForecast(getCardSlug(c))
  if (!r?.avg || !f?.price_forecast?.current_low) continue
  const mid = (f.price_forecast.current_low + f.price_forecast.current_high) / 2
  const ratio = mid / r.avg
  if (ratio > 1.5 || ratio < 0.67) { fcBad++; if (fcBad <= 15) console.log(`   ${c.id.padEnd(42)} 実勢 ¥${r.avg.toLocaleString()} / 予想表示 ¥${Math.round(mid).toLocaleString()} = ${ratio.toFixed(2)}倍`) }
}
console.log(`   計 ${fcBad}件`)

// ── 7. 孤児ファイル ────────────────────────────────────────
section('7. 孤児の価格ファイル（pokeca_data.json に存在しないカード）')
const known = new Set(cards.map(c => getCardSlug(c)))
const boxIds = new Set(boxes.map(b => `box-${b.box_id}`))
const orphans = fs.readdirSync(pricesDir).map(f => f.replace(/\.json$/, ''))
  .filter(id => !known.has(id) && !id.startsWith('box-'))
const boxOrphans = fs.readdirSync(pricesDir).map(f => f.replace(/\.json$/, ''))
  .filter(id => id.startsWith('box-') && !boxIds.has(id.replace(/-(shrink|noshrink|tohoku|hiroshima|fukuoka)$/, '')))
console.log(`   カード孤児 ${orphans.length}件 / BOX孤児 ${boxOrphans.length}件`)
orphans.slice(0, 10).forEach(o => console.log('    ', o))
boxOrphans.forEach(o => console.log('    ', o))

// ── 9. ノコギリ波（相場は動いていないのに価格だけ往復している） ──────────
// 2026-07-29 の調査で最大の不具合だった症状の再発検知。旧推定量は採用サンプルの集合が
// 日替わりで総入れ替えになり、avg が「+23% → 翌日 -19%」と同じ値を往復していた。
// 出品価格(ask)が動いていないのに avg だけが往復していたら推定量side の問題を疑う。
section('9. ノコギリ波（ask が動いていないのに avg が往復）')
let zigzag = 0
for (const c of cards) {
  const h = read(getCardSlug(c))
  if (!h || h.length < 10) continue
  const asc = [...h].sort((a, b) => a.date.localeCompare(b.date))
  let flips = 0, maxAmp = 0
  for (let i = 1; i < asc.length - 1; i++) {
    const p = asc[i - 1], r = asc[i], n = asc[i + 1]
    if (p.avg == null || r.avg == null || n.avg == null) continue
    const d1 = (r.avg - p.avg) / p.avg, d2 = (n.avg - r.avg) / r.avg
    // 山（上げてすぐ下げ）か谷（下げてすぐ上げ）で、どちらも15%以上
    if (Math.sign(d1) === Math.sign(d2) || Math.abs(d1) < 0.15 || Math.abs(d2) < 0.15) continue
    // ask が同方向に追随していれば本物の変動
    const askRef = r.ask_mid ?? r.ask_low, askPrev = p.ask_mid ?? p.ask_low
    if (askRef != null && askPrev != null && Math.abs((askRef - askPrev) / askPrev) >= 0.10) continue
    flips++
    maxAmp = Math.max(maxAmp, Math.abs(d1), Math.abs(d2))
  }
  if (flips >= 2) {
    zigzag++
    console.log(`   ${c.id.padEnd(44)} 往復${flips}回 最大振幅${Math.round(maxAmp * 100)}%`)
  }
}
if (!zigzag) console.log('   なし')

// ── 8. BOX: シュリンクあり < シュリンクなし（通常あり得ない） ─────────
section('8. BOX シュリンクあり ≦ シュリンクなし（逆転）')
let boxBad = 0
for (const b of boxes) {
  const s = read(`box-${b.box_id}-shrink`)?.[0]
  const n = read(`box-${b.box_id}-noshrink`)?.[0]
  if (!s || !n || s.avg == null || n.avg == null) continue
  // 数%の逆転は代表値の誤差の範囲。guardPrice の R3 と同じ 0.95 を境にする
  // （1%の逆転で毎日CIを赤くすると、本物の異常が埋もれて誰も見なくなる）
  if (s.avg < n.avg * 0.95) { boxBad++; console.log(`   ${b.box_name.padEnd(20)} あり ¥${s.avg.toLocaleString()} < なし ¥${n.avg.toLocaleString()} の0.95倍`) }
}
if (!boxBad) console.log('   なし')

// ── 10. 成約サンプルが古い（現在相場が過去の取引で出ている） ─────────
// メルカリの成約検索は売れた時期を問わず全期間を返す。年に数回しか動かない銘柄では
// 直近90日に成約が無く、スクレイパーが窓を180日→365日→全期間と広げて値を出している。
// 値上がり/値下がりの途中だと、その古い成約がそのまま「現在相場」になる。
// （レックウザVMAX SA: 353日前の¥294,600が現在相場の下限として表示されていた）
section('10. 成約サンプルが古い（採用した最古の成約が90日超前）')
const staleSold: Array<{ id: string; days: number; avg: number; n?: number }> = []
for (const c of [...cards.map(c => ({ id: getCardSlug(c) })), ...boxes.flatMap(b => [
  { id: `box-${b.box_id}` }, { id: `box-${b.box_id}-shrink` }, { id: `box-${b.box_id}-noshrink` },
])]) {
  const r = read(c.id)?.[0]
  if (!r || r.oldest_sale_days == null || r.oldest_sale_days <= 90 || r.avg == null) continue
  staleSold.push({ id: c.id, days: r.oldest_sale_days, avg: r.avg, n: r.sample_count })
}
staleSold.sort((a, b) => b.days - a.days)
console.log(`   ${staleSold.length}件`)
for (const s of staleSold.slice(0, 30)) {
  console.log(`   ${s.id.padEnd(44)} 最古${String(s.days).padStart(4)}日前  ¥${s.avg.toLocaleString()}${s.n != null ? ` (n=${s.n})` : ''}`)
}
if (!staleSold.length) console.log('   なし')

// ── 11. 現在の表示価格が「関門」を通らない ───────────────────────
// scrape-prices.ts の guardPrice をそのまま再生する。書き込み時に守っている条件を
// 保存済みデータにも当てるので、ここに出るものは「今サイトに出ている壊れた価格」。
// ⚠️ 検出ルールを増やす時は guardPrice 側に足すこと。このセクションは自動で追随する。
section('11. 現在の表示価格が guardPrice を通らない（＝今サイトに出ている異常値）')
const guardHits: string[] = []
const allIds = [
  ...cards.map(c => getCardSlug(c)),
  ...boxes.flatMap(b => [`box-${b.box_id}`, `box-${b.box_id}-shrink`, `box-${b.box_id}-noshrink`]),
]
for (const id of allIds) {
  const h = read(id)
  if (!h || h.length < 2) continue
  const [cur, prev] = h
  if (cur.avg == null) continue
  const v = guardPrice({
    id, date: cur.date, avg: cur.avg,
    priceSource: cur.source ?? 'mercari',
    onSale: { count: cur.on_sale ?? null, askLow: cur.ask_low ?? null, askMid: cur.ask_mid ?? null } as never,
    prev,
  })
  if (!v.ok) guardHits.push(`   ${id.padEnd(44)} ${cur.date} ¥${cur.avg.toLocaleString()} ← ${v.reason}`)
}
console.log(`   ${guardHits.length}件`)
guardHits.forEach(s => console.log(s))

// ── 判定 ────────────────────────────────────────────────
// 「重大」だけで exit 1 する。更新遅れ等の情報系まで赤くすると誰も見なくなるため。
// ⚠️ これまで価格の異常に最初に気づくのが利用者だった。この行が最後の防波堤。
section('判定')
// 予想の乖離も重大に含める。画面の価格表示は forecast.price_forecast 由来なので、
// 価格ファイルを直しても予想を再生成しない限り**利用者には古い値が見え続ける**。
const serious = guardHits.length + psaBad + boxBad + fcBad
console.log(`   関門を通らない現在価格: ${guardHits.length}件`)
console.log(`   PSA10 ≦ 素体:          ${psaBad}件`)
console.log(`   BOXシュリンク逆転:      ${boxBad}件`)
console.log(`   予想と実勢の乖離:       ${fcBad}件（画面に出るのは予想側の値）`)
if (serious > 0) {
  console.error(`\n❌ 重大な異常 ${serious}件。data/prices を確認すること。`)
  process.exit(1)
}
console.log('\n✅ 重大な異常なし')
