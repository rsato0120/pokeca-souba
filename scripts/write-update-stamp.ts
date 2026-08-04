// 日次バッチが「いつ・何を」更新したかを data/last-update.json に残す。
// 画面の「最終更新 8/4 21:03」と次回更新までのカウントダウンがこれを見る。
//
// 使い方: npx tsx scripts/write-update-stamp.ts [full|prices]
//   full   … 価格＋AI予想まで更新した回（JST 9:00）
//   prices … 価格だけ更新した回（JST 21:00。Geminiの日次上限があるので予想は回さない）
import * as fs from 'fs'
import * as path from 'path'
import type { LastUpdate } from '@/types/pokeca'

const kind: LastUpdate['kind'] = process.argv[2] === 'prices' ? 'prices' : 'full'
const stamp: LastUpdate = { updated_at: new Date().toISOString(), kind }

const file = path.join(process.cwd(), 'data', 'last-update.json')
fs.writeFileSync(file, JSON.stringify(stamp, null, 2), 'utf-8')
console.log(`更新スタンプを書きました: ${stamp.updated_at} (${kind})`)
