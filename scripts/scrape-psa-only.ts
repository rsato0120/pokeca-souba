import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const SNKRDUNK_IDS_FILE = path.join(process.cwd(), 'data', 'snkrdunk-ids.json')
const pricesDir = path.join(process.cwd(), 'data', 'prices')

function todayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

async function getSnkrdunkPsa10(apparelId: number): Promise<number | null> {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' })
  try {
    await page.goto(`https://snkrdunk.com/apparels/${apparelId}/sales-histories`, {
      waitUntil: 'load', timeout: 20000
    })
    await new Promise(r => setTimeout(r, 2500))
    const text = await page.evaluate(() => document.body.innerText)

    const psa10Patterns = ['状態PSA10の売買履歴', 'PSA10の売買履歴', 'PSA 10の売買履歴', 'PSA10の']
    const psa10Start = psa10Patterns.reduce((acc, s) => acc >= 0 ? acc : text.indexOf(s), -1)
    if (psa10Start < 0) { console.log('  PSA10セクションが見つかりません'); return null }

    const psa9Patterns = ['状態PSA9の売買履歴', 'PSA9の売買履歴', 'PSA 9の売買履歴', 'PSA9の']
    const psa9Start = psa9Patterns.reduce((acc, s) => {
      const i = text.indexOf(s, psa10Start + 4)
      return acc >= 0 ? acc : (i > psa10Start ? i : -1)
    }, -1)

    const psa10Section = text.slice(psa10Start, psa9Start > 0 ? psa9Start : psa10Start + 2000)
    const noHistory = ['まだこの商品は取引がありません', '取引がありません', '売買履歴はまだありません']
    if (noHistory.some(s => psa10Section.includes(s))) { console.log('  PSA10取引なし'); return null }

    // スニダンは円マークなしで「179,000」形式で価格を表示する
    const prices = [...psa10Section.matchAll(/\b(\d{1,3}(?:,\d{3})+)\b/g)]
      .map(m => parseInt(m[1].replace(/,/g, ''))).filter(p => p >= 1000)
    if (prices.length === 0) { console.log('  PSA10価格が取得できません (text sample:', psa10Section.slice(0, 200), ')'); return null }
    return Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  } catch (e) {
    console.log('  エラー:', (e as Error).message)
    return null
  } finally {
    await browser.close()
  }
}

async function main() {
  const ids: Record<string, number> = JSON.parse(fs.readFileSync(SNKRDUNK_IDS_FILE, 'utf-8'))
  const date = todayJST()
  console.log(`PSA価格取得: ${Object.keys(ids).length}件 (${date})\n`)

  for (const [cardId, apparelId] of Object.entries(ids)) {
    process.stdout.write(`[${cardId}] apparel=${apparelId} ... `)
    const psa10 = await getSnkrdunkPsa10(apparelId)

    if (psa10 != null) {
      const filePath = path.join(pricesDir, `${cardId}.json`)
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        const idx = data.history.findIndex((r: { date: string }) => r.date === date)
        if (idx >= 0) {
          data.history[idx].psa10 = psa10
        } else {
          console.log(`  (本日レコードなし、スキップ)`)
          continue
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
        console.log(`PSA10 ¥${psa10.toLocaleString()}`)
      } catch {
        console.log(`  価格ファイルなし`)
      }
    } else {
      console.log('取得失敗')
    }
    await new Promise(r => setTimeout(r, 2000))
  }

  console.log('\n完了')
}

main()
