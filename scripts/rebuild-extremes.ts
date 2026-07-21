// data/price-extremes.json を価格履歴から作り直す。
//
// 用途:
//   1) 初期投入（手元にある履歴を「計測開始」として取り込む）
//   2) 偽の極値が入ってしまった時のリセット（算出方式の切替などで avg が跳ねた日を
//      拾ってしまうと、その値が半永久的に最高値として残るため）
//
// ⚠️ 履歴は90日ローリングなので、作り直すと**窓から落ちた期間の極値は失われる**。
//    通常運用では実行せず、極値が明らかにおかしい時だけ使うこと。
//
// 実行: npx tsx scripts/rebuild-extremes.ts [--dry] [cardIdの接頭辞]
import * as fs from 'fs'
import * as path from 'path'
import { computeExtremes } from '@/lib/extremes'
import type { PriceExtremes, PriceHistory } from '@/types/pokeca'

const pricesDir = path.join(process.cwd(), 'data', 'prices')
const OUT_FILE = path.join(process.cwd(), 'data', 'price-extremes.json')

function main() {
  const args = process.argv.slice(2)
  const dry = args.includes('--dry')
  const filter = args.find(a => !a.startsWith('--')) ?? null

  const out: Record<string, PriceExtremes> = {}
  let skipped = 0

  for (const file of fs.readdirSync(pricesDir).filter(f => f.endsWith('.json'))) {
    const cardId = file.replace(/\.json$/, '')
    if (filter && !cardId.startsWith(filter)) continue

    let data: PriceHistory
    try { data = JSON.parse(fs.readFileSync(path.join(pricesDir, file), 'utf-8')) } catch { continue }

    const ex = computeExtremes(data.history ?? [])
    if (!ex) { skipped++; continue }
    out[cardId] = ex
  }

  const entries = Object.entries(out)
  console.log(`${entries.length}件の極値を算出（対象外 ${skipped}件）`)
  for (const [id, ex] of entries.slice(0, 5)) {
    console.log(`  ${id}: 高 ¥${ex.high.value.toLocaleString()}(${ex.high.date}) / 安 ¥${ex.low.value.toLocaleString()}(${ex.low.date}) / ${ex.records}日分`)
  }

  if (dry) { console.log('\n--dry のため書き込みませんでした'); return }

  // 部分実行（filter付き）でも既存分を消さないようにマージする
  let existing: Record<string, PriceExtremes> = {}
  if (filter) {
    try { existing = JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8')) } catch {}
  }
  fs.writeFileSync(OUT_FILE, JSON.stringify({ ...existing, ...out }, null, 2) + '\n', 'utf-8')
  console.log(`\n書き込み: ${path.relative(process.cwd(), OUT_FILE)}`)
}

main()
