import type { Metadata } from 'next'
import { getAllCards, getAllBoxes, getForecast, getPriceHistory, getBoxPriceHistory, getBoxPriceVariant } from '@/lib/data'
import PortfolioView, { type PortfolioCardData } from '@/components/PortfolioView'
import KaitoriLink from '@/components/KaitoriLink'

export const metadata: Metadata = {
  title: 'マイコレクション',
  description: '持っているカードのAI予想合計額を確認',
}

export default function PortfolioPage() {
  const cards = getAllCards()
  const boxes = getAllBoxes()
  const boxMap = new Map(boxes.map(b => [b.box_id, b.box_name]))

  const portfolioCards: PortfolioCardData[] = cards.map(card => {
    const forecast = getForecast(card.id)
    const history = getPriceHistory(card.id)
    const today = history?.history[0]
    const low = today?.low ?? 0
    const high = today?.high ?? 0

    // 評価額グラフ用に直近90日の中央値(mid)を昇順で渡す（表示期間の切替はクライアント側）
    const records = history?.history ?? []
    const hist = records
      .slice(0, 90)
      .map(r => ({
        date: r.date,
        mid: r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2,
      }))
      .reverse()

    // PSA10: 直近90日のpsa10価格（nullの日は除外）を昇順で。現在値は直近の既知値。
    const psaHist = records
      .slice(0, 90)
      .filter(r => r.psa10 != null)
      .map(r => ({ date: r.date, mid: Number(r.psa10) }))
      .reverse()
    const psa10Current = records.find(r => r.psa10 != null)?.psa10 ?? null

    return {
      id: card.id,
      card_name: card.card_name,
      rarity: card.rarity,
      card_no: card.card_no,
      box_name: boxMap.get(card.box_id) ?? card.box_id,
      image_url: card.image_url ?? null,
      currentLow: low,
      currentHigh: high,
      currentMid: low > 0 && high > 0 ? Math.round((low + high) / 2) : 0,
      m3Low: forecast?.price_forecast.m3_low ?? null,
      m3High: forecast?.price_forecast.m3_high ?? null,
      history: hist,
      psa10Current: psa10Current != null ? Number(psa10Current) : null,
      psa10History: psaHist,
    }
  })

  // ── 未開封BOXも資産に入れる ──
  // BOXを「もう1種類の保有」として同じ配列に流し込む。PortfolioView 側の保有ロジック
  // （素体/PSA10の枠、評価額グラフ、含み損益）はそのまま使える。
  //
  // ⚠ シュリンクあり/なしは**別キー**にする。同じBOXでも相場が数千円違う
  //   （ストームエメラルダ: あり¥13,990 / なし¥12,398）ので、まとめると評価額がずれる。
  // ⚠ box_name は弾名ではなく「未開封BOX」で揃える。PortfolioView の弾コンプ判定が
  //   box_name 単位で「掲載種類数」を数えるため、弾名にするとその弾の分母を
  //   BOXのぶんだけ水増ししてコンプ率が永遠に埋まらなくなる。
  // ⚠ psa10Current は null。BOXに鑑定品は無い。
  const boxHoldings: PortfolioCardData[] = []
  for (const b of boxes) {
    if (b.certainty !== 'released') continue
    for (const [suffix, label, shrink] of [['noshrink', 'シュリンクなし', false], ['shrink', 'シュリンクあり', true]] as const) {
      const hist = getBoxPriceVariant(b.box_id, suffix)?.history ?? null
      // 変異系列が無い弾は混在系列で代用する（片方しか出品が無い弾がある）
      const series = hist ?? (shrink ? null : getBoxPriceHistory(b.box_id)?.history ?? null)
      if (!series || series.length === 0) continue
      const today = series[0]
      const mid = today.avg != null ? Number(today.avg) : (Number(today.low) + Number(today.high)) / 2
      if (!(mid > 0)) continue
      boxHoldings.push({
        id: `box:${b.box_id}${shrink ? '#shrink' : ''}`,
        card_name: `${b.box_name} 未開封BOX`,
        rarity: label,
        card_no: b.code,
        box_name: '未開封BOX',
        image_url: b.pack_image_url ?? null,
        currentLow: today.low,
        currentHigh: today.high,
        currentMid: Math.round(mid),
        // BOXにAI予想は無いので3ヶ月後は出さない（無い数字を埋めない）
        m3Low: null,
        m3High: null,
        history: series
          .slice(0, 90)
          .map(r => ({ date: r.date, mid: r.avg != null ? Number(r.avg) : (Number(r.low) + Number(r.high)) / 2 }))
          .reverse(),
        psa10Current: null,
        psa10History: [],
        href: `/boxes/${b.box_id}`,
      })
    }
  }

  const releasedBoxes = boxes
    .filter(b => b.certainty === 'released')
    .map(b => ({ box_id: b.box_id, box_name: b.box_name }))

  return (
    <>
      <PortfolioView cards={[...portfolioCards, ...boxHoldings]} boxes={releasedBoxes} />
      {/* 買取導線（A8 / PR）。含み損益を見た直後＝売却を検討する動機が最も高い場所。
          ⚠ PortfolioView と同じ幅の段に入れること。素で置くと画面幅いっぱいに
          伸びて左端に貼りつき、ページの一部に見えない。 */}
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 16px 32px' }}>
        <KaitoriLink />
      </div>
    </>
  )
}
