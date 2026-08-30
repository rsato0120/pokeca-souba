import Link from 'next/link'

// 値動きランキング（急騰／急落）の2カラム。
//
// ⚠ 2026-08-30 にトップページのJSXから切り出した。トップ（要約・各3件）と
//   /ranking の「値動き」タブ（各10件）で同じ見た目を使うため。コピーすると
//   片方だけ変化率の丸めや「前日比/7日比」の表記が変わって食い違う。

export interface MoverRow {
  slug: string
  name: string
  rarity: string
  image: string | null
  mid: number
  /** 変化率(%)。前日比が取れなければ7日比 */
  changePct: number
  /** 「前日比」or「7日比」 */
  changeLabel: string
}

function Column({ rows, dir }: { rows: MoverRow[]; dir: 'up' | 'down' }) {
  const color = dir === 'up' ? 'var(--up)' : 'var(--down)'
  return (
    <div>
      <div className="eyebrow" style={{ color, fontWeight: 600, marginBottom: 'var(--sp-2)' }}>
        {dir === 'up' ? '▲ 急騰' : '▼ 急落'}
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-faint)' }}>データ不足</div>
      ) : rows.map((m) => (
        <Link key={m.slug} href={`/cards/${m.slug}`} className="row" style={{ gridTemplateColumns: '36px 1fr auto', gap: 'var(--sp-2)' }}>
          {m.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.image} alt={m.name} className="row-thumb" style={{ width: '36px', height: '50px' }} />
          ) : (
            <div className="row-thumb row-thumb-ph" style={{ width: '36px', height: '50px' }}>{m.rarity}</div>
          )}
          <div style={{ minWidth: 0 }}>
            <div className="row-name" style={{ fontSize: 'var(--fs-base)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
            <div className="row-meta">{m.rarity} · ¥{Math.round(m.mid).toLocaleString()}</div>
            <div className="row-meta">{m.changeLabel}</div>
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-base)', fontWeight: 700, color, textAlign: 'right', whiteSpace: 'nowrap' }}>
            {m.changePct > 0 ? '+' : ''}{m.changePct.toFixed(1)}%
          </div>
        </Link>
      ))}
    </div>
  )
}

export default function MoversList({ surge, drop }: { surge: MoverRow[]; drop: MoverRow[] }) {
  return (
    <div className="rank-cols">
      <Column rows={surge} dir="up" />
      <Column rows={drop} dir="down" />
    </div>
  )
}
