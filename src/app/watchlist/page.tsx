import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllCards, getAllBoxes, getCardSlug, getForecast, getPriceHistory, getPriceExtremes } from '@/lib/data'
import { getMarketIndex, indexChangePct } from '@/lib/index-series'
import { midOf } from '@/lib/market'
import type { ScreenerRow } from '@/components/ScreenerTable'
import WatchlistView from '@/components/WatchlistView'
import ThemeToggle from '@/components/ThemeToggle'

export const metadata: Metadata = {
  title: 'ウォッチリスト',
  description: '気になるポケモンカードを登録して、登録時からの値動きを追いかけられます。大きく動いた日には通知も受け取れます。',
  // 端末ごとの中身なので検索結果に出しても意味がない
  robots: { index: false, follow: true },
}

const DAY_GUARD = 20
const WEEK_GUARD = 35

export default function WatchlistPage() {
  const cards = getAllCards()
  const boxNames = new Map(getAllBoxes().map((b) => [b.box_id, b.box_name]))

  // どのカードが登録されているかはビルド時には分からないので、
  // スクリーナーと同じ行データを丸ごと渡してクライアント側で突き合わせる
  const rows: ScreenerRow[] = cards.map((card) => {
    const slug = getCardSlug(card)
    const records = getPriceHistory(slug)?.history ?? []
    const today = records[0]
    const yesterday = records[1]
    const weekAgo = records[7]
    const extremes = getPriceExtremes(slug)
    const mid = today ? midOf(today) : 0

    const guard = (v: number | null, limit: number) => (v != null && Math.abs(v) <= limit ? v : null)

    return {
      id: slug,
      name: card.card_name,
      rarity: card.rarity,
      boxId: card.box_id,
      boxName: boxNames.get(card.box_id) ?? card.box_id,
      image: card.image_url ?? null,
      mid: Math.round(mid),
      dayChange: guard(
        today && yesterday && midOf(yesterday) > 0 ? ((mid - midOf(yesterday)) / midOf(yesterday)) * 100 : null,
        DAY_GUARD,
      ),
      weekChange: guard(
        today && weekAgo && midOf(weekAgo) > 0 ? ((mid - midOf(weekAgo)) / midOf(weekAgo)) * 100 : null,
        WEEK_GUARD,
      ),
      onSale: today?.on_sale ?? null,
      upPct: getForecast(slug)?.overall.up_pct ?? null,
      upsidePct: null,
      psa10: records.find((r) => r.psa10 != null)?.psa10 ?? null,
      offHigh: extremes && extremes.high.value > 0 && mid > 0
        ? Math.max(0, ((extremes.high.value - mid) / extremes.high.value) * 100)
        : null,
      rangePos: null,
    }
  })

  const allIndex = getMarketIndex('all')
  const index7d = allIndex ? indexChangePct(allIndex, 7) : null

  return (
    <div className="wrap" style={{ maxWidth: '860px' }}>
      <Link
        href="/"
        style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-sm)', color: 'var(--ink-faint)', letterSpacing: '0.06em', display: 'inline-block', padding: '18px 0 10px' }}
      >
        ← トップへ戻る
      </Link>
      <header className="site-header">
        <div className="logo">相場</div>
        <div className="tagline">ポケモンカードの価値を、AIが読み解く</div>
        <ThemeToggle />
      </header>

      <h1 style={{ fontFamily: 'var(--mincho)', fontSize: 'var(--fs-xl)', fontWeight: 800, margin: 'var(--sp-5) 0 var(--sp-2)' }}>
        ウォッチリスト
      </h1>
      <p style={{ fontSize: 'var(--fs-base)', color: 'var(--ink-dim)', lineHeight: 1.85, marginBottom: 'var(--sp-5)' }}>
        買うかどうか迷っているカードを登録しておく一覧です。
        持っているカードの評価額は<Link href="/portfolio" style={{ color: 'var(--gold)' }}>マイコレクション</Link>で管理できます。
      </p>

      <WatchlistView cards={rows} index7d={index7d} />
    </div>
  )
}
