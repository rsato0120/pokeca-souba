// PSA鑑定枚数（Population）を取得して data/psa-pop.json に保存する。
//
// なぜ gemrate なのか:
//   psacard.com と pricecharting は Cloudflare のbot判定で 403（ヘッドレスPlaywrightでも突破できず）。
//   gemrate.com は PSA の集計を配信していて、item-details ページの HTML に
//   `var RowData = JSON.parse('[...]')` としてカード単位のグレード分布が埋め込まれている。
//   **1弾につき1リクエストで全カード分が取れる**ため、カード単位のID対応表は不要。
//
// 実行: npx tsx scripts/scrape-psa-pop.ts [box_id]
// 出力: data/psa-pop.json  { [cardId]: { psa10, total, gem_rate, parallel, name, set_name, fetched_at } }
import * as fs from 'fs'
import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getAllCards, getCardSlug } from '@/lib/data'

const execFileAsync = promisify(execFile)

const SETS_FILE = path.join(process.cwd(), 'data', 'psa-sets.json')
const OUT_FILE = path.join(process.cwd(), 'data', 'psa-pop.json')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

interface PsaSet { year: number; set_name: string }
interface GemRow {
  card_number: string
  name: string
  parallel: string
  gems: number
  /** grades[10] が PSA10。合計が総鑑定枚数 */
  grades: number[]
  gem_rate: number
}

export interface PsaPopEntry {
  psa10: number
  total: number
  gem_rate: number   // 0-100
  parallel: string
  name: string
  set_name: string
  fetched_at: string
}

// fetch(undici)もヘッドレスPlaywrightも 403 になる（TLSフィンガープリントで弾かれている）。
// curl だけが通るので curl を使う。Windows 10+ と GitHub Actions のどちらにも標準で入っている。
async function fetchHtml(url: string): Promise<string> {
  const { stdout } = await execFileAsync(
    'curl',
    ['-sS', '--fail', '--compressed', '--max-time', '60', '-A', UA, '-H', 'Accept-Language: en-US,en;q=0.9', url],
    { maxBuffer: 20 * 1024 * 1024 }
  )
  return stdout
}

async function fetchRows(set: PsaSet): Promise<GemRow[]> {
  const url = `https://www.gemrate.com/item-details?grader=psa&year=${set.year}`
    + `&category=tcg-cards&set_name=${encodeURIComponent(set.set_name)}`
  const html = await fetchHtml(url)
  const m = html.match(/var RowData = JSON\.parse\('([\s\S]*?)'\)/)
  if (!m) throw new Error('RowData が見つからない（ページ構造が変わった可能性）')
  // JS のシングルクォート文字列なので、名前に含まれるアポストロフィ（N's Plot 等）が \' で escape されている
  return JSON.parse(m[1].replace(/\\'/g, "'"))
}

// "169/086" → "169"（gemrate 側も3桁ゼロ埋め）
function cardNumberOf(cardNo: string): string {
  const head = cardNo.split('/')[0].trim()
  return /^\d+$/.test(head) ? head.padStart(3, '0') : head
}

async function main() {
  const boxFilter = process.argv[2] ?? null
  const sets: Record<string, PsaSet> = JSON.parse(fs.readFileSync(SETS_FILE, 'utf-8'))
  const cards = getAllCards()
  const fetchedAt = new Date().toISOString().slice(0, 10)

  let out: Record<string, PsaPopEntry> = {}
  try { out = JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8')) } catch {}

  const boxIds = Object.keys(sets).filter(b => !boxFilter || b === boxFilter)
  console.log(`PSA鑑定枚数を取得します（${boxIds.length}弾）\n`)

  let matched = 0, missed = 0
  for (const boxId of boxIds) {
    const boxCards = cards.filter(c => c.box_id === boxId)
    if (boxCards.length === 0) continue
    process.stdout.write(`  [${boxId}] ${sets[boxId].set_name} ... `)

    let rows: GemRow[]
    try {
      rows = await fetchRows(sets[boxId])
    } catch (e) {
      console.log(`失敗: ${e instanceof Error ? e.message : e}`)
      continue
    }

    // card_number ごとに候補をまとめる。ミラー違い（Master Ball Reverse Holo 等）が
    // 同番号で並ぶことがあるので、素の刷り（Base/レアリティ名）を優先し、無ければ最多鑑定を採る。
    const byNumber = new Map<string, GemRow[]>()
    for (const r of rows) {
      const key = String(r.card_number).trim()
      byNumber.set(key, [...(byNumber.get(key) ?? []), r])
    }

    let hit = 0, miss = 0
    for (const card of boxCards) {
      const num = cardNumberOf(card.card_no)
      const candidates = byNumber.get(num) ?? byNumber.get(String(Number(num))) ?? []
      if (candidates.length === 0) { miss++; continue }

      const picked = candidates.length === 1
        ? candidates[0]
        : candidates.find(c => !/mirror|reverse/i.test(c.parallel))
          ?? [...candidates].sort((a, b) => sum(b.grades) - sum(a.grades))[0]

      const total = sum(picked.grades)
      out[getCardSlug(card)] = {
        psa10: picked.gems,
        total,
        gem_rate: Math.round(picked.gem_rate * 1000) / 10,
        parallel: picked.parallel,
        name: picked.name,
        set_name: sets[boxId].set_name,
        fetched_at: fetchedAt,
      }
      hit++
    }
    matched += hit; missed += miss
    console.log(`${rows.length}行取得 → ${hit}/${boxCards.length}枚 一致${miss > 0 ? `（未一致${miss}枚）` : ''}`)

    // 相手サーバーへの配慮（1弾1リクエストなので総数は十数回）
    await new Promise(r => setTimeout(r, 3000))
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + '\n', 'utf-8')
  console.log(`\n完了: ${matched}枚に鑑定枚数を紐付け（未一致 ${missed}枚）→ ${path.relative(process.cwd(), OUT_FILE)}`)
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + Number(b || 0), 0)
}

main()
