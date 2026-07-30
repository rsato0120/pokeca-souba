// 高騰/値下がり/AI注目カードを1日数回Xに自動投稿する。
// モードは引数 or JST時刻で決定: 朝=surge / 昼=drop / 夜=ai
// 使い方: npx tsx scripts/post-movers-tweet.ts [surge|drop|ai]
// X APIキー(環境変数)が無ければドライラン（投稿せず文面を出力）。
import { getAllCards, getCardSlug, getForecast, getPriceHistory } from '@/lib/data'
import type { Card, Forecast, PriceRecord } from '@/types/pokeca'

const SITE = 'https://pokeca-souba.vercel.app'
const DAY = 24 * 60 * 60 * 1000

type Mode = 'surge' | 'drop' | 'ai'

function jstNow(): Date { return new Date(Date.now() + 9 * 60 * 60 * 1000) }

function modeFromHour(): Mode {
  const h = jstNow().getUTCHours()
  if (h < 11) return 'surge'
  if (h < 17) return 'drop'
  return 'ai'
}

function midOf(r: PriceRecord): number {
  return r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2
}

// 直近の今日と「約7日前」を比べた週間変化率
function weekChange(history: PriceRecord[]): number | null {
  if (history.length < 2) return null
  const today = history[0]
  const targetMs = new Date(today.date).getTime() - 7 * DAY
  let past = history[history.length - 1]
  for (const r of history) {
    if (new Date(r.date).getTime() <= targetMs) { past = r; break }
  }
  const a = midOf(past), b = midOf(today)
  if (a <= 0) return null
  return ((b - a) / a) * 100
}

function signalLabel(fc: Forecast | null): string {
  if (!fc) return '🟡様子見'
  if (fc.overall.up_pct >= 45) return '🟢買い'
  if (fc.overall.down_pct >= 45) return '🔴弱気'
  return '🟡様子見'
}

interface Mover { card: Card; slug: string; mid: number; wk: number; fc: Forecast | null }

function collectMovers() {
  const out: Mover[] = []
  for (const card of getAllCards()) {
    const slug = getCardSlug(card)
    const ph = getPriceHistory(slug)
    if (!ph || ph.history.length === 0) continue
    const mid = Math.round(midOf(ph.history[0]))
    if (mid <= 0) continue
    const wk = weekChange(ph.history)
    if (wk == null || Math.abs(wk) > 200) continue // データ異常を除外
    out.push({ card, slug, mid, wk: Math.round(wk), fc: getForecast(slug) })
  }
  return out
}

function pickRising() {
  // AIが上昇と見ているカード（up>down かつ 3ヶ月後本線が現在超）
  const out: Mover[] = []
  for (const card of getAllCards()) {
    const slug = getCardSlug(card)
    const fc = getForecast(slug)
    const ph = getPriceHistory(slug)
    if (!fc || !ph || ph.history.length === 0) continue
    const p = fc.price_forecast
    const cur = (p.current_low + p.current_high) / 2
    const m3 = (p.m3_low + p.m3_high) / 2
    if (!(fc.overall.up_pct > fc.overall.down_pct && cur > 0 && m3 > cur)) continue
    out.push({ card, slug, mid: Math.round(midOf(ph.history[0])), wk: 0, fc })
  }
  return out.sort((a, b) => (b.fc!.overall.up_pct) - (a.fc!.overall.up_pct))
}

function compose(mode: Mode, m: Mover): string {
  const name = `${m.card.card_name} ${m.card.rarity}`
  const url = `${SITE}/cards/${m.slug}`
  const sig = signalLabel(m.fc)
  const tags = '#ポケカ #ポケカ相場'
  if (mode === 'surge') {
    return `📈 急騰中のポケカ\n${name}\n¥${m.mid.toLocaleString()}（週間 +${m.wk}%）\nAI予想：${sig}\n${url}\n${tags}`
  }
  if (mode === 'drop') {
    return `📉 値下がり中（押し目？）\n${name}\n¥${m.mid.toLocaleString()}（週間 ${m.wk}%）\nAI予想：${sig}\n${url}\n${tags}`
  }
  // ai
  const up = m.fc?.overall.up_pct ?? 0
  return `🤖 AIの注目カード\n${name}\n現在 ¥${m.mid.toLocaleString()} ／ 上昇期待度 ${up}%\nAI予想：${sig}\n${url}\n${tags}`
}

function selectTweet(mode: Mode): { mode: Mode; text: string } | null {
  if (mode === 'ai') {
    const r = pickRising()[0]
    return r ? { mode, text: compose('ai', r) } : null
  }
  const movers = collectMovers()
  // 安価カード(<¥1,000)とデータ異常(±60%超)を除外して、見栄えする変動だけ拾う
  const MIN_PRICE = 1000, MAX_ABS = 60
  if (mode === 'surge') {
    const top = movers.filter(m => m.wk >= 8 && m.wk <= MAX_ABS && m.mid >= MIN_PRICE).sort((a, b) => b.wk - a.wk)[0]
    if (top) return { mode, text: compose('surge', top) }
  } else {
    const top = movers.filter(m => m.wk <= -8 && m.wk >= -MAX_ABS && m.mid >= MIN_PRICE).sort((a, b) => a.wk - b.wk)[0]
    if (top) return { mode, text: compose('drop', top) }
  }
  // 該当なしならAI注目にフォールバック
  const r = pickRising()[0]
  return r ? { mode: 'ai', text: compose('ai', r) } : null
}

// X APIの失敗は原因ごとに対処が違うので、生のスタックトレースではなく
// 「次に何をすればいいか」まで出す。
function reportPostError(err: any) {
  const code: number | undefined = err?.code
  const detail: string = err?.data?.detail ?? err?.message ?? '詳細不明'
  const accessLevel = err?.headers?.['x-access-level']
  console.error(`❌ 投稿失敗（${code ?? '不明'}）: ${detail}`)
  if (code === 402) {
    console.error('   X APIの月次クレジットを使い切っています。')
    console.error('   Developer Portal → Dashboard で残量とリセット日を確認してください。')
  } else if (code === 403) {
    console.error(`   アプリの権限が不足しています（x-access-level: ${accessLevel ?? '不明'}）。`)
    console.error('   App permissions を Read and write にした「後で」アクセストークンを再生成し、')
    console.error('   X_ACCESS_TOKEN / X_ACCESS_SECRET を更新してください（再生成しないと権限は反映されません）。')
  } else if (code === 401) {
    console.error('   キーの値が違います。X_API_KEY にBearer Tokenを入れていないか確認してください。')
    console.error('   X_API_KEY は Consumer Keys の API Key（25文字前後）です。')
  } else if (code === 429) {
    console.error('   レート制限です。時間をおいて再実行してください。')
  }
}

async function post(text: string) {
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env
  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
    // CI上でのDRY RUNは「緑なのに投稿ゼロ」を招くので失敗として扱う。
    if (process.env.CI) {
      console.error('❌ X APIキーが未設定です。GitHub Secrets に以下4つが登録されているか確認してください:')
      console.error('   X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET')
      console.error('   ※ Variables タブではなく Secrets タブです。')
      process.exitCode = 1
      return
    }
    console.log('--- DRY RUN（X APIキー未設定・投稿しません）---')
    console.log(text)
    console.log(`--- 文字数: ${[...text].length} ---`)
    return
  }
  const { TwitterApi } = await import('twitter-api-v2')
  const client = new TwitterApi({
    appKey: X_API_KEY, appSecret: X_API_SECRET,
    accessToken: X_ACCESS_TOKEN, accessSecret: X_ACCESS_SECRET,
  })
  try {
    const res = await client.v2.tweet(text)
    console.log('投稿完了:', res.data.id)
  } catch (err) {
    reportPostError(err)
    process.exitCode = 1
  }
}

async function main() {
  const arg = process.argv[2] as Mode | undefined
  const mode: Mode = arg && ['surge', 'drop', 'ai'].includes(arg) ? arg : modeFromHour()
  const picked = selectTweet(mode)
  if (!picked) { console.log('対象カードなし — スキップ'); return }
  console.log(`モード: ${picked.mode}`)
  await post(picked.text)
}

main()
