'use client'
import Link from 'next/link'
import { useCollection, psaKey } from '@/hooks/useCollection'
import { useLastVisit, daysBetween, todayJST } from '@/hooks/useLastVisit'

// トップ最上部の「あなた」の帯。相場そのものは誰が見ても同じなので、
// 再訪の理由になるのはここに出る2つの数字だけ。
//   ① 保有カードの評価額と前日比（毎日変わるので毎日開く口実になる）
//   ② 前回開いた日からの値動き（その人にしか出せない差分）
// どちらも localStorage 由来なので、出せるものが無ければ帯ごと消える。

export type MarketCard = {
  id: string
  name: string
  rarity: string
  mid: number
  prevMid: number | null   // 前日（サイト全体の最新日の1日前）時点の代表値
  psa10: number | null
  prevPsa10: number | null
}

const MOVER_MIN_PCT = 2   // これ未満は「動いた」と言えないので出さない
const MOVER_LIMIT = 3

function signedYen(v: number): string {
  return `${v >= 0 ? '+' : '−'}¥${Math.abs(Math.round(v)).toLocaleString()}`
}

function deltaColor(v: number): string {
  return v > 0 ? 'var(--up)' : v < 0 ? 'var(--down)' : 'var(--ink-dim)'
}

// "2026-08-01" → "8/1"（サイトの他の日付表記に合わせる）
export function md(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
}

export default function VisitorStrip({ cards }: { cards: MarketCard[] }) {
  const { col } = useCollection()
  const snapshot: Record<string, number> = {}
  for (const c of cards) if (c.mid > 0) snapshot[c.id] = Math.round(c.mid)
  const { prev, ready } = useLastVisit(snapshot)

  // ── ① 保有評価額 ──
  // 買値は入れていない人が多いので、ここは含み損益ではなく「評価額と前日比」を出す。
  //
  // 前日比は**前日の値が分かっている保有だけ**で計算する（評価額は全保有の合計）。
  // 1銘柄でも前日が欠測したら前日比ごと消す作りにすると、履歴の浅いカードを1枚持った
  // だけで数字が出なくなる。分母も同じ部分集合で取るので率は歪まない。
  let qty = 0
  let value = 0
  let prevBase = 0
  let prevDiff = 0
  for (const c of cards) {
    const raw = col[c.id] ?? 0
    if (raw > 0 && c.mid > 0) {
      qty += raw
      value += c.mid * raw
      if (c.prevMid != null && c.prevMid > 0) {
        prevBase += c.prevMid * raw
        prevDiff += (c.mid - c.prevMid) * raw
      }
    }
    const graded = col[psaKey(c.id)] ?? 0
    if (graded > 0 && c.psa10 != null) {
      qty += graded
      value += c.psa10 * graded
      if (c.prevPsa10 != null && c.prevPsa10 > 0) {
        prevBase += c.prevPsa10 * graded
        prevDiff += (c.psa10 - c.prevPsa10) * graded
      }
    }
  }
  const dayDiff = prevBase > 0 ? prevDiff : null
  const dayPct = dayDiff != null ? (dayDiff / prevBase) * 100 : null

  // ── ② 前回訪問からの値動き ──
  const gap = prev ? daysBetween(prev.date, todayJST()) : 0
  const movers = prev
    ? cards
        .map((c) => {
          const was = prev.prices[c.id]
          if (!was || was <= 0 || c.mid <= 0) return null
          const pct = ((c.mid - was) / was) * 100
          return { c, was, pct }
        })
        .filter((m): m is { c: MarketCard; was: number; pct: number } => m != null && Math.abs(m.pct) >= MOVER_MIN_PCT)
        .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
        .slice(0, MOVER_LIMIT)
    : []

  // サーバー側では何も描かない（localStorage を読むまで内容が決まらないため）
  if (!ready) return null
  if (qty === 0 && movers.length === 0) return null

  return (
    <div className="visitor-strip">
      {qty > 0 && (
        <Link href="/portfolio" className="visitor-pill">
          <span className="visitor-pill-label">あなたの保有 {qty}枚</span>
          <span className="visitor-pill-value">¥{Math.round(value).toLocaleString()}</span>
          {dayDiff != null && dayPct != null && (
            <span style={{ color: deltaColor(dayDiff), fontWeight: 700 }}>
              {signedYen(dayDiff)}（{dayPct >= 0 ? '+' : ''}{dayPct.toFixed(1)}%）
              <span style={{ color: 'var(--ink-faint)', fontWeight: 400, marginLeft: '4px' }}>前日比</span>
            </span>
          )}
          <span className="visitor-pill-go">→</span>
        </Link>
      )}

      {movers.length > 0 && (
        <div className="visitor-since">
          <div className="visitor-since-head">
            前回見たとき（{md(prev!.date)}{gap > 0 && <>・{gap}日前</>}）から動いたカード
          </div>
          <div className="visitor-movers">
            {movers.map(({ c, was, pct }) => (
              <Link key={c.id} href={`/cards/${c.id}`} className="visitor-mover">
                <span className="visitor-mover-name">{c.name}</span>
                <span className="visitor-mover-rarity">{c.rarity}</span>
                <span className="visitor-mover-price">
                  ¥{Math.round(was).toLocaleString()} → ¥{Math.round(c.mid).toLocaleString()}
                </span>
                <span className="visitor-mover-delta" style={{ color: deltaColor(pct) }}>
                  <span aria-hidden="true">{pct > 0 ? '↗' : '↘'} </span>
                  {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
