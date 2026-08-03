/**
 * vote-score.ts の採点が実データで意図どおり動くかを確かめる使い捨ての検算スクリプト。
 * 本物の価格履歴に合成した票をぶつけ、「7日後に上がっていた銘柄で up が的中になるか」
 * 「新しすぎる票が採点対象外になるか」など、境界だけを見る。
 *
 *   npx tsx scripts/check-vote-score.ts
 */
import fs from 'fs'
import path from 'path'
import { scoreVote, rankUsers, daysAgo, HORIZON_DAYS, WINDOW_DAYS, type PriceMatrix, type RawVote } from '../src/lib/vote-score'
import { isHit } from '../src/lib/stance'

const MATRIX_DAYS = WINDOW_DAYS + 3
const baseDate = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
const baseMs = Date.parse(`${baseDate}T00:00:00+09:00`)

const pricesDir = path.join(process.cwd(), 'data', 'prices')
const prices: PriceMatrix = {}
for (const name of fs.readdirSync(pricesDir).filter(f => f.endsWith('.json') && !f.startsWith('box-'))) {
  const data = JSON.parse(fs.readFileSync(path.join(pricesDir, name), 'utf-8'))
  const series: (number | null)[] = new Array(MATRIX_DAYS).fill(null)
  let filled = false
  for (const r of data.history ?? []) {
    const idx = Math.round((baseMs - Date.parse(`${r.date}T00:00:00+09:00`)) / 86400000)
    if (idx < 0 || idx >= MATRIX_DAYS) continue
    const mid = r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2
    if (!(mid > 0)) continue
    series[idx] = Math.round(mid)
    filled = true
  }
  if (filled) prices[data.card_id] = series
}
console.log(`価格マトリクス: ${Object.keys(prices).length}枚 × ${MATRIX_DAYS}日`)

function isoDaysAgo(n: number): string {
  return new Date(baseMs - n * 86400000 + 12 * 3600000).toISOString()
}

// ── 1. daysAgo が JST の暦日で数えられているか
const checks: Array<[string, boolean]> = []
checks.push(['daysAgo(今日) = 0', daysAgo(baseDate, isoDaysAgo(0)) === 0])
checks.push([`daysAgo(${HORIZON_DAYS}日前) = ${HORIZON_DAYS}`, daysAgo(baseDate, isoDaysAgo(HORIZON_DAYS)) === HORIZON_DAYS])

// ── 2. 境界: 新しすぎる票／古すぎる票は採点対象外
// vote-score 側の欠測許容（TOLERANCE_DAYS=2, 手前=より古い日へ遡る）と同じ引き方をする。
// 当日ぶんのスクレイプがまだ走っていない朝は index 0 が空なので、ここを厳密一致にすると
// 「検算できるカードが無い」で検算そのものが空振りする。
const resolve = (s: (number | null)[], i: number): number | null => {
  for (let k = i; k <= i + 2 && k < s.length; k++) if (s[k] != null && s[k]! > 0) return s[k]
  return null
}
const sample = Object.keys(prices).find(id => {
  const s = prices[id]
  return resolve(s, 0) != null && resolve(s, HORIZON_DAYS) != null && resolve(s, WINDOW_DAYS) != null
})
if (!sample) { console.log('検算に使える連続した履歴のカードが無い'); process.exit(0) }
console.log(`検算カード: ${sample}`)

const vote = (stance: RawVote['stance'], age: number): RawVote =>
  ({ card_id: sample, user_id: 'u1', stance, updated_at: isoDaysAgo(age) })

checks.push([`${HORIZON_DAYS - 1}日前の票は未採点(null)`, scoreVote(vote('up', HORIZON_DAYS - 1), prices, baseDate) === null])
checks.push([`${WINDOW_DAYS + 1}日前の票は対象外(null)`, scoreVote(vote('up', WINDOW_DAYS + 1), prices, baseDate) === null])
checks.push([`${HORIZON_DAYS}日前の票は採点される`, scoreVote(vote('up', HORIZON_DAYS), prices, baseDate) !== null])

// ── 3. 実際の値動きと採点結果が一致するか
const s = prices[sample]!
const atVote = resolve(s, HORIZON_DAYS)!
const atNow = resolve(s, 0)!
const changePct = ((atNow - atVote) / atVote) * 100
console.log(`  ${HORIZON_DAYS}日前 ¥${atVote} → 今日 ¥${atNow}（${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%）`)
for (const st of ['up', 'flat', 'down'] as const) {
  const got = scoreVote(vote(st, HORIZON_DAYS), prices, baseDate)
  checks.push([`  ${st} の判定が isHit と一致`, got === isHit(st, changePct)])
}

// ── 4. 集計: MIN_SCORED 未満の人は落ちる
const votes: RawVote[] = [
  { card_id: sample, user_id: 'few', stance: 'up', updated_at: isoDaysAgo(HORIZON_DAYS) },
]
checks.push(['予想1件だけの人はランキングに出ない', rankUsers(votes, prices, baseDate).length === 0])

let ok = true
for (const [label, passed] of checks) {
  console.log(`${passed ? '  OK  ' : '  NG  '} ${label}`)
  if (!passed) ok = false
}
console.log(ok ? '\n全て期待どおり' : '\n⚠ 期待と違う項目がある')
process.exit(ok ? 0 : 1)
