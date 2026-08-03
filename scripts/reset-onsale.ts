/**
 * 出品件数（on_sale）の基準を切り替えた時に、旧基準の値を履歴から落とす一度きりのスクリプト。
 *
 * なぜ必要か:
 *   on_sale は「絶対値」より「前日比」で使われている。
 *     - トップの「今買われている/売られているカード」（src/app/page.tsx）＝前日比の増減で並べる
 *     - buy-signals の supplyTightening ＝直近2レコードの比較
 *     - AI予想プロンプト（src/lib/forecast.ts）＝窓の最古と最新の比較
 *   件数の数え方を変えた日は、**新基準の今日 vs 旧基準の昨日**を比べることになり、
 *   全カードが一斉に「急に売れた」ように見える偽シグナルが出る。さらに savePriceHistory の
 *   品質ゲート（前日比60%未満は保存しない＝IPブロック対策）が、正しい新しい値を軒並み捨てる。
 *
 *   2026-07-01 にも同じ事故を起こしている（クエリにBOX名を足した日）。その時は env の
 *   ONSALE_NO_GATE=1 と手作業で凌いだので、今回スクリプトとして残す。
 *
 * 使い方:
 *   npx tsx scripts/reset-onsale.ts --dry     # 影響範囲だけ表示
 *   npx tsx scripts/reset-onsale.ts           # 実行（全 data/prices/*.json から on_sale を除去）
 *
 * 実行後は次のスクレイプが「前日 on_sale なし」の状態から始まるので、ゲートは素通りし
 * 新基準の値がそのまま入る（ONSALE_NO_GATE は不要）。前日比を使う画面は1日だけ空になり、
 * 翌日から自動で復帰する。
 */
import fs from 'fs'
import path from 'path'

const pricesDir = path.join(process.cwd(), 'data', 'prices')
const dry = process.argv.includes('--dry')
// ファイル名の接頭辞で対象を絞れる（例: `box-` で未開封BOX/セットだけリセット）。
// カードとBOXでは件数の数え方を変えた時期が違うので、片方だけ established し直せる必要がある。
const prefix = process.argv.slice(2).find(a => !a.startsWith('--')) ?? ''

let files = 0
let recordsCleared = 0
const samples: string[] = []

for (const name of fs.readdirSync(pricesDir).filter(f => f.endsWith('.json') && f.startsWith(prefix))) {
  const filePath = path.join(pricesDir, name)
  let data: { card_id: string; history: Array<Record<string, unknown>> }
  try { data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) } catch { continue }
  if (!Array.isArray(data.history)) continue

  let cleared = 0
  for (const record of data.history) {
    if (record.on_sale != null) {
      if (samples.length < 8) samples.push(`${name.replace('.json', '')} ${record.date} on_sale=${record.on_sale}`)
      delete record.on_sale
      cleared++
    }
  }
  if (cleared === 0) continue

  files++
  recordsCleared += cleared
  if (!dry) fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

console.log(`${dry ? '[dry] ' : ''}${prefix ? `[${prefix}*] ` : ''}${files}ファイル / ${recordsCleared}レコードから on_sale を除去`)
console.log('例:')
for (const s of samples) console.log(`  ${s}`)
if (dry) console.log('\n実行するには --dry を外してください')
