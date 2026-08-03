import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllCards, getCardSlug, getPriceHistory } from '@/lib/data'
import { computeAccuracy, HORIZONS } from '@/lib/accuracy'
import VoteLeaderboard from '@/components/VoteLeaderboard'
import { HORIZON_DAYS, WINDOW_DAYS, type PriceMatrix } from '@/lib/vote-score'

export const metadata: Metadata = {
  title: 'みんなの予想 的中率ランキング',
  description: 'ポケモンカードの相場予想に投票した閲覧者の的中率ランキング。AI予想の的中率と同じ基準で採点しています。',
}

// 採点に必要な日数ぶんの価格を焼き込む。
// 直近 WINDOW_DAYS 日の票を、それぞれ投票から HORIZON_DAYS 後まで見るので、
// 最も古い票の投票日は WINDOW_DAYS 日前 ＝ そこから今日までの価格が要る。
// 欠測の遡り（vote-score.ts の TOLERANCE_DAYS）に少し余裕を持たせて +3 日。
const MATRIX_DAYS = WINDOW_DAYS + 3

function todayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export default function RankingPage() {
  const baseDate = todayJST()
  const baseMs = Date.parse(`${baseDate}T00:00:00+09:00`)

  // カードごとに「N日前の代表値」を密な配列に詰める（index = 日数, 0=今日, 欠測は null）。
  // 日付文字列を持たせないのはページに焼くデータ量を抑えるため。
  const prices: PriceMatrix = {}
  for (const card of getAllCards()) {
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

  // AI側の的中率を同じページに出して対比させる（採点の日数・式は揃えてある）
  const acc = computeAccuracy()
  const aiSeven = acc.byHorizon[HORIZONS[0]]

  return (
    <div className="wrap" style={{ maxWidth: '760px' }}>
      <Link
        href="/"
        style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-faint)', letterSpacing: '0.06em', display: 'inline-block', padding: '18px 0 10px' }}
      >
        ← トップへ戻る
      </Link>
      <header className="site-header">
        <div className="logo">相場</div>
        <div className="tagline">ポケモンカードの価値を、AIが読み解く</div>
      </header>

      <h1 style={{ fontFamily: 'var(--mincho)', fontSize: '26px', fontWeight: 800, margin: '24px 0 6px' }}>
        みんなの予想 的中率ランキング
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.8, marginBottom: '24px' }}>
        カード詳細ページの「みんなの予想」に投じられた票を、投票から{HORIZON_DAYS}日後の実際の相場と照合しています。
        判定の日数と式は<Link href="/accuracy" style={{ color: 'var(--gold)' }}>AI予想の的中実績</Link>と同じなので、
        同じ土俵で見比べられます。
      </p>

      {/* AIの成績を先に置いて基準線にする */}
      <div style={{ border: '1px solid var(--hair)', borderRadius: '8px', padding: '14px 16px', marginBottom: '24px', background: 'var(--panel)' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-faint)', letterSpacing: '0.08em', marginBottom: '6px' }}>
          比較用: AI予想の{HORIZON_DAYS}日的中率
        </div>
        {aiSeven.resolved > 0 ? (
          <div style={{ fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: 700 }}>
            {aiSeven.rate}%
            <span style={{ fontSize: '12px', color: 'var(--ink-faint)', marginLeft: '8px', fontWeight: 400 }}>
              （{aiSeven.resolved}件を採点）
            </span>
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--ink-faint)' }}>まだ採点できる予想がありません</div>
        )}
      </div>

      <VoteLeaderboard prices={prices} baseDate={baseDate} />

      <p style={{ fontSize: '12px', color: 'var(--ink-faint)', lineHeight: 1.8, marginTop: '24px' }}>
        ※ 直近{WINDOW_DAYS}日ぶんの投票を対象にしたローリング集計です。順位は毎日入れ替わります。
        投票は<Link href="/" style={{ color: 'var(--gold)' }}>各カードのページ</Link>から、ログイン不要で参加できます。
      </p>
    </div>
  )
}
