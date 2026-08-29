import Link from 'next/link'
import type { BoxRankRow } from '@/lib/box-ranking'

// 未開封BOXのランキング。並びは7日変化率の降順（src/lib/box-ranking.ts 参照）。
//
// 定価比は絶版弾だと桁が違う（タッグボルトは約79倍）ので、順位付けには使わず情報として添える。
// 倍率で並べると常に古い弾が上位を占め、「いま動いている弾」が見えなくなる。

const VARIANT_LABEL: Record<NonNullable<BoxRankRow['onSaleVariant']>, string> = {
  noshrink: 'シュリンクなし',
  mixed: '混在',
  shrink: 'シュリンクあり',
}

export default function BoxRanking({ rows }: { rows: BoxRankRow[] }) {
  if (rows.length === 0) return null

  return (
    <div className="boxrank">
      {rows.map((r, i) => {
        const tone = r.weekPct == null ? 'var(--ink-faint)' : r.weekPct > 0 ? 'var(--up)' : r.weekPct < 0 ? 'var(--down)' : 'var(--flat)'
        return (
          <Link key={r.boxId} href={`/boxes/${r.boxId}`} className="boxrank-row">
            <span className="boxrank-no">{i + 1}</span>

            {r.packImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.packImage} alt={r.boxName} className="boxrank-thumb" referrerPolicy="no-referrer" />
            ) : (
              <span className="boxrank-thumb boxrank-thumb-ph">{r.code}</span>
            )}

            <span className="boxrank-main">
              <span className="boxrank-name">{r.boxName}</span>
              <span className="boxrank-meta">
                {r.code} · {r.releaseYm} · 価格は{VARIANT_LABEL[r.variant]}
                {/* 出品件数は価格と別系列（シュリンクあり優先）なので、どちらの数字か必ず添える。
                    あり7件 / なし118件 のように逆転する弾があり、書かないと品薄の判断を誤る */}
                {r.onSale != null && r.onSaleVariant != null && (
                  <> · 出品は{VARIANT_LABEL[r.onSaleVariant]}{r.onSale}件{r.onSaleCapped && '以上'}</>
                )}
              </span>
            </span>

            <span className="boxrank-price">
              <span className="boxrank-mid">¥{r.mid.toLocaleString()}</span>
              {r.premiumPct != null && (
                <span className="boxrank-premium">
                  定価比 {r.premiumPct >= 0 ? '+' : ''}{r.premiumPct.toLocaleString()}%
                </span>
              )}
            </span>

            <span className="boxrank-week" style={{ color: tone }}>
              {r.weekPct == null ? '—' : `${r.weekPct > 0 ? '+' : ''}${r.weekPct.toFixed(1)}%`}
              <span className="boxrank-week-label">7日</span>
            </span>
          </Link>
        )
      })}
    </div>
  )
}
