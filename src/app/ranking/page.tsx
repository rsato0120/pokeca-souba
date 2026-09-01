import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllCards, getAllBoxes, getCardSlug, getForecast, getPriceHistory, getBoxPriceHistory, getBoxPriceVariant, getMarketListings } from '@/lib/data'
import { computeAccuracy, HORIZONS } from '@/lib/accuracy'
import { isDeckUtilityCard } from '@/lib/card-kind'
import { midOf } from '@/lib/market'
import { buildBoxRanking } from '@/lib/box-ranking'
import VoteLeaderboard from '@/components/VoteLeaderboard'
import CommunityPicks, { type PickCard } from '@/components/CommunityPicks'
import BoxRanking from '@/components/BoxRanking'
import TrendingCards, { type TrendCard } from '@/components/TrendingCards'
import MoversList, { type MoverRow } from '@/components/MoversList'
import RankingTabs, { type RankingTab } from '@/components/RankingTabs'
import { HORIZON_DAYS, WINDOW_DAYS, type PriceMatrix } from '@/lib/vote-score'
import SiteHeader from "@/components/SiteHeader"
import SalesRanking, { type SalesRankRow } from '@/components/SalesRanking'

// ランキングタブ。値動き／閲覧／みんなの予想／BOX をページ内タブで切り替える。
//
// ⚠ URL は /ranking のまま（以前は「みんなの予想 的中率ランキング」の単独ページだった）。
//   既存の被リンクを壊さないよう、みんなの予想はタブの1つとして残している。

export const metadata: Metadata = {
  title: 'ランキング',
  description: 'ポケモンカードの値動き・閲覧数・みんなの予想の的中率・未開封BOXのランキング。実際の成約価格から算出しています。',
}

// 採点に必要な日数ぶんの価格を焼き込む（みんなの予想タブ用）。
const MATRIX_DAYS = WINDOW_DAYS + 3

function todayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

const DAY_GUARD = 20
const WEEK_GUARD = 35

export default function RankingPage() {
  const baseDate = todayJST()
  const baseMs = Date.parse(`${baseDate}T00:00:00+09:00`)
  const cards = getAllCards()
  const marketListings = getMarketListings()
  const newestPriceDate = cards
    .map((card) => getPriceHistory(getCardSlug(card))?.history[0]?.date ?? '')
    .sort()
    .at(-1) ?? baseDate
  const salesFromDate = new Date(`${newestPriceDate}T00:00:00+09:00`)
  salesFromDate.setUTCDate(salesFromDate.getUTCDate() - 6)
  const salesFrom = salesFromDate.toISOString().slice(0, 10)

  const salesRanking = cards
    .filter((card) => !isDeckUtilityCard(card))
    .map((card) => {
      const slug = getCardSlug(card)
      const priceHistory = getPriceHistory(slug)
      const latest = priceHistory?.history[0]
      if (!latest) return null
      const sales7d = Object.entries(priceHistory.sales_by_day ?? {})
        .filter(([date]) => date >= salesFrom && date <= newestPriceDate)
        .reduce((sum, [, count]) => sum + Number(count), 0)
      if (sales7d <= 0) return null
      const row: SalesRankRow = {
        slug,
        name: card.card_name,
        rarity: card.rarity,
        image: card.image_url ?? null,
        mid: midOf(latest),
        sales7d,
        onSale: latest.on_sale ?? null,
        onSaleCapped: latest.on_sale_capped === true,
        listings: marketListings?.cards[slug]?.listings ?? [],
      }
      return row
    })
    .filter((row): row is SalesRankRow => row != null)
    .sort((a, b) => b.sales7d - a.sales7d || (a.onSale ?? Infinity) - (b.onSale ?? Infinity))
    .slice(0, 20)

  // ── みんなの予想タブ用の価格行列 ──
  const prices: PriceMatrix = {}
  for (const card of cards) {
    const slug = getCardSlug(card)
    const records = getPriceHistory(slug)?.history ?? []
    if (records.length === 0) continue
    const series: (number | null)[] = new Array(MATRIX_DAYS).fill(null)
    let filled = false
    for (const r of records) {
      const idx = Math.round((baseMs - Date.parse(`${r.date}T00:00:00+09:00`)) / 86400000)
      if (idx < 0 || idx >= MATRIX_DAYS) continue
      const mid = r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2
      if (!(mid > 0)) continue
      series[idx] = Math.round(mid)
      filled = true
    }
    if (filled) prices[slug] = series
  }

  // ── 値動きタブ ──
  const guard = (v: number | null, limit: number) => (v != null && Math.abs(v) <= limit ? v : null)
  const movers = cards
    .filter((c) => !isDeckUtilityCard(c))
    .map((card) => {
      const slug = getCardSlug(card)
      const rec = getPriceHistory(slug)?.history ?? []
      const t = rec[0], y = rec[1], w = rec[7]
      if (!t) return null
      const mid = midOf(t)
      if (!(mid > 0)) return null
      const day = guard(y && midOf(y) > 0 ? ((mid - midOf(y)) / midOf(y)) * 100 : null, DAY_GUARD)
      const week = guard(w && midOf(w) > 0 ? ((mid - midOf(w)) / midOf(w)) * 100 : null, WEEK_GUARD)
      const changePct = day ?? week
      if (changePct == null) return null
      const row: MoverRow = {
        slug,
        name: card.card_name,
        rarity: card.rarity,
        image: card.image_url ?? null,
        mid,
        changePct,
        changeLabel: day != null ? '前日比' : '7日比',
      }
      return row
    })
    .filter((r): r is MoverRow => r != null)

  const surge = [...movers].filter((m) => m.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, 10)
  const drop = [...movers].filter((m) => m.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 10)

  // ── 閲覧タブ ──
  const trendCards: TrendCard[] = cards.map((card) => {
    const slug = getCardSlug(card)
    const rec = getPriceHistory(slug)?.history ?? []
    const t = rec[0], y = rec[1]
    const mid = t ? midOf(t) : 0
    return {
      id: slug,
      name: card.card_name,
      rarity: card.rarity,
      image: card.image_url ?? null,
      price: mid > 0 ? mid : null,
      dayChange: guard(t && y && midOf(y) > 0 ? ((mid - midOf(y)) / midOf(y)) * 100 : null, DAY_GUARD),
    }
  })

  // ── BOXタブ ──
  const boxRanking = buildBoxRanking(
    getAllBoxes().map((box) => ({
      box,
      noshrink: getBoxPriceVariant(box.box_id, 'noshrink')?.history ?? null,
      mixed: getBoxPriceHistory(box.box_id)?.history ?? null,
      shrink: getBoxPriceVariant(box.box_id, 'shrink')?.history ?? null,
    })),
  )

  // 「みんなの予想 注目カード」（どのカードに票が入っているか）。票は Supabase 側にあるので
  // id→表示情報を丸ごと渡してクライアントで突き合わせる。
  const pickCards: PickCard[] = cards.map((card) => ({
    id: getCardSlug(card),
    name: card.card_name,
    rarity: card.rarity,
    image: card.image_url ?? null,
    aiUp: getForecast(getCardSlug(card))?.overall.up_pct ?? null,
  }))

  const acc = computeAccuracy()
  const aiSeven = acc.byHorizon[HORIZONS[0]]

  const tabs: RankingTab[] = [
    {
      id: 'sales',
      label: '売れ筋',
      note: `直近7日（${salesFrom.replaceAll('-', '/')}〜${newestPriceDate.replaceAll('-', '/')}）の実成約数順。出品中の商品はカード番号とカード名を照合したメルカリ出品です。`,
      node: <SalesRanking rows={salesRanking} />,
    },
    {
      id: 'movers',
      label: '値動き',
      note: '実際の成約価格の変化率。前日比が取れないカードは7日比で並べています。',
      node: <MoversList surge={surge} drop={drop} />,
    },
    {
      id: 'views',
      label: '閲覧',
      note: '直近で見られているカード。1カードにつき1日1訪問者まで数えています。',
      node: <TrendingCards cards={trendCards} />,
    },
    {
      id: 'votes',
      label: 'みんなの予想',
      note: `投票した人の的中率。採点の日数と式は AI予想の的中実績と同じです（${HORIZON_DAYS}日後判定・AI ${aiSeven.resolved > 0 ? `${Math.round(aiSeven.rate)}%` : '集計中'}）。`,
      node: (<><CommunityPicks cards={pickCards} /><VoteLeaderboard prices={prices} baseDate={baseDate} /></>),
    },
    {
      id: 'boxes',
      label: 'BOX',
      note: '未開封BOXの7日変化率順。価格・変化率・出品数はすべて同じシュリンク状態の系列から出しています。',
      node: <BoxRanking rows={boxRanking.slice(0, 20)} />,
    },
  ]

  return (
    <div className="wrap" style={{ maxWidth: '860px' }}>
      <SiteHeader />

      <h1 style={{ fontFamily: 'var(--mincho)', fontSize: '24px', fontWeight: 800, margin: '8px 0 6px' }}>ランキング</h1>
      <p style={{ fontSize: '13px', color: 'var(--ink-faint)', lineHeight: 1.8, marginBottom: '20px' }}>
        すべて実際の成約データから算出しています。判定の基準は
        <Link href="/accuracy" style={{ color: 'var(--accent)' }}>AI予想の的中実績</Link>と揃えてあります。
      </p>

      <RankingTabs tabs={tabs} />
    </div>
  )
}
