import Link from 'next/link'
import { ANOMALY_LEVELS, type AnomalyCard } from '@/lib/anomaly'

// ⚡ AI異変検知。価格がまだ動いていないのに、その手前の量（在庫・取引・鑑定品価格・値動きの荒さ）が
// 動いているカードを出す。ロジックは src/lib/anomaly.ts。
//
// ⚠ 評価できなかったシグナルは「対象外」として明示する。出さないと、材料が揃っている銘柄と
//   揃っていない銘柄が同じ顔で並び、★の数が実力差に見えてしまう。

export interface AnomalyRow extends AnomalyCard {
  image: string | null
}

export default function AnomalyFeed({ rows }: { rows: AnomalyRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="anom-empty">
        いま異変を検知しているカードはありません。在庫・取引件数・PSA10価格差・値動きの荒さを毎日見ています。
      </div>
    )
  }

  return (
    <div className="anom-list">
      {rows.map(r => {
        const lv = ANOMALY_LEVELS[r.level]
        return (
          <article key={r.slug} className="anom-card">
            <Link
              href={`/cards/${r.slug}`}
              aria-label={`${r.card.card_name} ${r.card.rarity} の詳細`}
              style={{ position: 'absolute', inset: 0, zIndex: 1, borderRadius: 'var(--r-lg)' }}
            />
            <div className="anom-head">
              {r.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.image} alt={`${r.card.card_name} ${r.card.rarity}`} className="anom-thumb" referrerPolicy="no-referrer" />
              ) : (
                <div className="anom-thumb heat-thumb-ph">{r.card.rarity}</div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="heat-name">{r.card.card_name}</div>
                <div className="heat-meta">{r.card.rarity} · ¥{r.mid.toLocaleString()}</div>
              </div>
              <div className="anom-level">
                <div className="anom-level-label">
                  <span aria-hidden>{lv.emoji}</span> {lv.label}
                </div>
                <div className="anom-stars" aria-label={`異変レベル ${lv.stars} / 4`}>
                  {'★'.repeat(lv.stars)}<span className="anom-star-off">{'☆'.repeat(4 - lv.stars)}</span>
                </div>
              </div>
            </div>

            <div className="anom-signals">
              {/* 価格は「まだ動いていない」ことを示すために先頭に置く */}
              <div className="anom-sig">
                <span className="pulse-label">価格(7日)</span>
                <span
                  className="anom-sig-val"
                  style={{ color: r.pricePct == null ? 'var(--ink-faint)' : Math.abs(r.pricePct) < 3 ? 'var(--ink-dim)' : r.pricePct > 0 ? 'var(--up)' : 'var(--down)' }}
                >
                  {r.pricePct == null ? '—' : `${r.pricePct > 0 ? '+' : ''}${r.pricePct.toFixed(1)}%`}
                </span>
              </div>
              {r.signals.map(s => (
                <div className="anom-sig" key={s.key} title={s.detail}>
                  <span className="pulse-label">{s.label}</span>
                  <span className="anom-sig-val" style={{ color: 'var(--accent)' }}>
                    {s.pct > 0 ? '+' : ''}{s.pct.toFixed(0)}%
                  </span>
                  <span className="anom-sig-detail">{s.detail}</span>
                </div>
              ))}
            </div>

            <p className="anom-verdict">
              {r.pricePct != null && Math.abs(r.pricePct) < 3
                ? '価格はまだほとんど動いていませんが、その手前の需給が動いています。'
                : '価格が動く前兆を検出しました。'}
            </p>

            {r.missing.length > 0 && (
              <p className="anom-missing">対象外: {r.missing.join(' / ')}</p>
            )}
          </article>
        )
      })}
    </div>
  )
}
