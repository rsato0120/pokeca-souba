// ウォッチリストの値動き通知を送る（日次バッチの最後に実行する）。
//
// 使い方:
//   npx tsx scripts/send-alerts.ts          # 実送信
//   npx tsx scripts/send-alerts.ts --dry    # 送らずに対象と文面だけ出す
//
// 必要な環境変数（どれか欠けていれば何もせず正常終了する＝バッチを止めない）:
//   NEXT_PUBLIC_SUPABASE_URL      購読の保存先
//   SUPABASE_SERVICE_ROLE_KEY     購読テーブルを読むための鍵（RLSを迂回できるので厳重に）
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
//
// 送る条件は2つだけ。多く送ると通知は即座に切られるので、
// 「毎日届く」ものではなく「動いた日だけ届く」ものにしてある。
//   ・前日比 ±ALERT_PCT% 以上
//   ・全期間の高値／安値を当日更新
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { getAllCards, getCardSlug, getPriceHistory, getPriceExtremes } from '@/lib/data'
import { extremeHitToday } from '@/lib/extremes'
import { midOf } from '@/lib/market'

const SITE = 'https://pokeca-souba.vercel.app'

/** 通知する前日比のしきい値(%) */
const ALERT_PCT = 10
/** これを超える前日比は汚染（出所フリップ・誤マッチ）の疑いが濃いので通知しない。画面のガードと同じ基準 */
const DAY_GUARD = 20
/** 1通に並べるカードの最大数。それ以上は「ほか◯件」に畳む */
const MAX_LISTED = 3

const dryRun = process.argv.includes('--dry')

interface Alert {
  cardId: string
  name: string
  rarity: string
  mid: number
  changePct: number | null
  extreme: 'high' | 'low' | null
}

/** 当日に「動いた」カードを洗い出す */
function collectAlerts(): Map<string, Alert> {
  const out = new Map<string, Alert>()

  for (const card of getAllCards()) {
    const slug = getCardSlug(card)
    const records = getPriceHistory(slug)?.history ?? []
    const today = records[0]
    const prev = records[1]
    if (!today) continue

    const mid = midOf(today)
    if (!(mid > 0)) continue

    let changePct: number | null = null
    if (prev) {
      const pv = midOf(prev)
      if (pv > 0) {
        const v = ((mid - pv) / pv) * 100
        // 汚染疑いは通知しない。誤報を1回でも送ると通知そのものを切られる
        if (Math.abs(v) <= DAY_GUARD) changePct = v
      }
    }

    const extreme = extremeHitToday(getPriceExtremes(slug), today.date)
    const moved = (changePct != null && Math.abs(changePct) >= ALERT_PCT) || extreme != null
    if (!moved) continue

    out.set(slug, {
      cardId: slug,
      name: card.card_name,
      rarity: card.rarity,
      mid: Math.round(mid),
      changePct,
      extreme,
    })
  }

  return out
}

function lineOf(a: Alert): string {
  const price = `¥${a.mid.toLocaleString()}`
  if (a.extreme === 'high') return `${a.name}（${a.rarity}）最高値更新 ${price}`
  if (a.extreme === 'low') return `${a.name}（${a.rarity}）最安値更新 ${price}`
  const sign = (a.changePct ?? 0) >= 0 ? '+' : ''
  return `${a.name}（${a.rarity}）${sign}${(a.changePct ?? 0).toFixed(1)}% ${price}`
}

/** 購読1件ぶんの通知本文を組む */
function buildPayload(hits: Alert[]): { title: string; body: string; url: string; tag: string } {
  const listed = hits.slice(0, MAX_LISTED).map(lineOf)
  const rest = hits.length - listed.length
  const body = listed.join('\n') + (rest > 0 ? `\nほか${rest}件` : '')

  // 1枚だけならそのカードのページへ、複数ならウォッチリストへ飛ばす
  const url = hits.length === 1 ? `${SITE}/cards/${hits[0].cardId}` : `${SITE}/watchlist`
  const title = hits.length === 1 ? '相場が動きました' : `ウォッチ中の${hits.length}枚が動きました`

  // 同じ日に2通届いても通知欄では1つにまとまるようtagを日付で固定する
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  return { title, body, url, tag: `souba-${today}` }
}

async function main() {
  const alerts = collectAlerts()
  console.log(`[alerts] 動いたカード: ${alerts.size}件`)
  if (alerts.size === 0) {
    console.log('[alerts] 対象なし。送信せず終了')
    return
  }

  if (dryRun) {
    for (const a of [...alerts.values()].slice(0, 20)) console.log('  -', lineOf(a))
    console.log('[alerts] --dry のため送信しません')
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const vapidPublic = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? SITE

  // 鍵が無い＝通知機能をまだ有効にしていない。バッチを失敗させず静かに抜ける
  if (!url || !serviceKey || !vapidPublic || !vapidPrivate) {
    console.log('[alerts] 環境変数が未設定のためスキップ（通知機能は無効）')
    return
  }

  webpush.setVapidDetails(subject, vapidPublic, vapidPrivate)
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, cards')
  if (error) {
    console.error('[alerts] 購読の取得に失敗:', error.message)
    process.exitCode = 1
    return
  }
  console.log(`[alerts] 購読: ${subs?.length ?? 0}件`)

  let sent = 0
  let skipped = 0
  const stale: string[] = []

  for (const sub of subs ?? []) {
    const hits = (sub.cards as string[])
      .map((id) => alerts.get(id))
      .filter((a): a is Alert => a != null)
      // 大きく動いたものを先に並べる（先頭3件しか本文に載らないため）
      .sort((a, b) => {
        const av = a.extreme ? 999 : Math.abs(a.changePct ?? 0)
        const bv = b.extreme ? 999 : Math.abs(b.changePct ?? 0)
        return bv - av
      })

    if (hits.length === 0) { skipped++; continue }

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(buildPayload(hits)),
      )
      sent++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      // 404/410 = 購読が失効している（通知OFF・ブラウザ再インストール）。行を掃除する
      if (status === 404 || status === 410) {
        stale.push(sub.endpoint)
      } else {
        console.error('[alerts] 送信失敗', status ?? '', (e as Error).message)
      }
    }
  }

  if (stale.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', stale)
    console.log(`[alerts] 失効した購読を削除: ${stale.length}件`)
  }

  console.log(`[alerts] 送信 ${sent}件 / 対象なし ${skipped}件`)
}

main().catch((e) => {
  console.error('[alerts] 想定外のエラー:', e)
  // 通知はサイト本体の付随機能。ここで落として価格更新のコミットを止めない
  process.exitCode = 0
})
