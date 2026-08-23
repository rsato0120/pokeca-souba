import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllCards, getAllBoxes, getCardSlug, getForecast, getPriceHistory, getPriceExtremes } from '@/lib/data'
import { getMarketIndex, indexChangePct } from '@/lib/index-series'
import { midOf } from '@/lib/market'
import ScreenerTable, { type ScreenerRow } from '@/components/ScreenerTable'
import ThemeToggle from '@/components/ThemeToggle'

export const metadata: Metadata = {
  title: 'カードスクリーナー',
  description: 'ポケモンカードを価格帯・収録弾・レアリティ・値動き・AI予想で絞り込んで探せる一覧。全収録カードを横断して比較できます。',
}

// 前日比・7日比の異常値ガード。トップページと同じ基準に揃える。
// （スクレイプの出所フリップや誤マッチで生じる飛びを、順位や絞り込みに混ぜない）
const DAY_GUARD = 20
const WEEK_GUARD = 35

export default function ScreenerPage() {
  const cards = getAllCards()
  const boxes = getAllBoxes()
  const boxNames = new Map(boxes.map((b) => [b.box_id, b.box_name]))

  const rows: ScreenerRow[] = cards.map((card) => {
    const slug = getCardSlug(card)
    const records = getPriceHistory(slug)?.history ?? []
    const today = records[0]
    const yesterday = records[1]
    const weekAgo = records[7]
    const forecast = getForecast(slug)
    const extremes = getPriceExtremes(slug)

    const mid = today ? midOf(today) : 0

    const guard = (v: number | null, limit: number) => (v != null && Math.abs(v) <= limit ? v : null)
    const dayChange = guard(
      today && yesterday && midOf(yesterday) > 0 ? ((mid - midOf(yesterday)) / midOf(yesterday)) * 100 : null,
      DAY_GUARD,
    )
    const weekChange = guard(
      today && weekAgo && midOf(weekAgo) > 0 ? ((mid - midOf(weekAgo)) / midOf(weekAgo)) * 100 : null,
      WEEK_GUARD,
    )

    // AIの3ヶ月後 本線の上昇率。「AIが上昇と予想」の絞り込みはこれで判定する
    // （up_pct は確率であって方向ではないので、単独だと下落予想も通ってしまう）
    const pf = forecast?.price_forecast
    const upsidePct = (() => {
      if (!pf) return null
      const cur = (pf.current_low + pf.current_high) / 2
      const m3 = (pf.m3_low + pf.m3_high) / 2
      return cur > 0 ? ((m3 - cur) / cur) * 100 : null
    })()

    // 全期間の高値からの下落率と値幅の中の位置（株の52週高値からの下落率にあたる）
    const offHigh = extremes && extremes.high.value > 0 && mid > 0
      ? Math.max(0, ((extremes.high.value - mid) / extremes.high.value) * 100)
      : null
    const rangePos = extremes && extremes.high.value > extremes.low.value && mid > 0
      ? Math.min(100, Math.max(0, ((mid - extremes.low.value) / (extremes.high.value - extremes.low.value)) * 100))
      : null

    return {
      id: slug,
      name: card.card_name,
      rarity: card.rarity,
      boxId: card.box_id,
      boxName: boxNames.get(card.box_id) ?? card.box_id,
      image: card.image_url ?? null,
      mid: Math.round(mid),
      dayChange,
      weekChange,
      onSale: today?.on_sale ?? null,
      upPct: forecast?.overall.up_pct ?? null,
      upsidePct,
      psa10: records.find((r) => r.psa10 != null)?.psa10 ?? null,
      offHigh,
      rangePos,
    }
  })

  // セレクタの選択肢。実際にカードがある弾・レアリティだけ出す
  const usedBoxIds = new Set(cards.map((c) => c.box_id))
  const boxOptions = boxes
    .filter((b) => usedBoxIds.has(b.box_id))
    .map((b) => ({ box_id: b.box_id, box_name: b.box_name }))
  const rarityCounts = new Map<string, number>()
  for (const c of cards) rarityCounts.set(c.rarity, (rarityCounts.get(c.rarity) ?? 0) + 1)
  const rarities = [...rarityCounts.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r)

  const allIndex = getMarketIndex('all')
  const index7d = allIndex ? indexChangePct(allIndex, 7) : null

  return (
    <div className="wrap" style={{ maxWidth: '1080px' }}>
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
        カードスクリーナー
      </h1>
      <p style={{ fontSize: 'var(--fs-base)', color: 'var(--ink-dim)', lineHeight: 1.85, marginBottom: 'var(--sp-5)' }}>
        収録している{cards.length}枚を横断して、価格帯・弾・レアリティ・値動き・AI予想で絞り込めます。
        列の見出しを押すと並べ替わります。
        {index7d != null && (
          <>
            {' '}「市場比」は7日比から
            <Link href="/" style={{ color: 'var(--gold)' }}>相場指数</Link>
            の同期間（{index7d >= 0 ? '+' : ''}{index7d.toFixed(2)}%）を引いた値で、正なら市場より強いカードです。
          </>
        )}
      </p>

      <ScreenerTable rows={rows} boxes={boxOptions} rarities={rarities} index7d={index7d} />

      <div className="disclaimer" style={{ marginTop: 'var(--sp-6)' }}>
        価格はメルカリの成約実績とスニーカーダンクの実取引から毎日自動取得した参考値です。
        AI予想は公開情報をもとに生成した参考情報であり、投資や売買を助言するものではありません。
      </div>
    </div>
  )
}
