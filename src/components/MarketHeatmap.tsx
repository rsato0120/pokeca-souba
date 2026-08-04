import Link from 'next/link'

// 掲載カード全部の前日比を1画面に並べる盤面。
// 「今日の相場が全体としてどうだったか」は行のリストを5件ずつ見ても分からないので、
// 面で見せる。日ごとに絵が変わるので、再訪したときの見た目の変化がいちばん大きい。
//
// ⚠ 配色は緑↔赤の発散配色だが、この2色は**P型/D型色覚では ΔE 5.0 まで潰れる**
//   （dataviz の validate_palette.js で確認）。数字が隣に無いセルの並びで色だけに
//   意味を持たせると読めなくなるので、下落セルには斜めのハッチを重ねて
//   色以外の手がかりを必ず持たせている。凡例にも同じハッチを出す。

export type HeatCell = {
  slug: string
  name: string
  rarity: string
  mid: number
  change: number | null   // 前日比%（欠測は null）
}

export type HeatGroup = {
  boxId: string
  boxName: string
  cells: HeatCell[]
}

// |変化率| を5段階に量子化する。連続グラデーションにすると凡例と対応が取れないので段にする。
const STEPS = [0.5, 1.5, 3, 6] as const
const MIX = [16, 34, 55, 76, 100] as const  // 各段の原色の混合率(%)

function level(abs: number): number {
  let i = 0
  while (i < STEPS.length && abs >= STEPS[i]) i++
  return i  // 0..4
}

function cellStyle(change: number | null): React.CSSProperties {
  if (change == null) {
    return { background: 'var(--bg2)', border: '1px solid var(--hair)' }
  }
  const lv = level(Math.abs(change))
  const hue = change > 0 ? 'var(--up)' : change < 0 ? 'var(--down)' : 'var(--flat)'
  return { background: `color-mix(in srgb, ${hue} ${MIX[lv]}%, var(--panel))` }
}

export default function MarketHeatmap({ groups }: { groups: HeatGroup[] }) {
  const all = groups.flatMap((g) => g.cells)
  const scored = all.filter((c) => c.change != null)
  const ups = scored.filter((c) => c.change! > 0).length
  const downs = scored.filter((c) => c.change! < 0).length
  const flats = scored.length - ups - downs
  if (scored.length < 20) return null

  // 全体の地合い。単純平均だと極端値に振られるので中央値を使う。
  const sorted = scored.map((c) => c.change!).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]

  return (
    <div className="sec">
      <div className="sec-head">
        <span className="sec-no">00</span>
        <span className="sec-title">今日の相場ぜんぶ</span>
        <span className="sec-sub">掲載{all.length}枚の前日比を一枚の盤面に</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-4)', flexWrap: 'wrap', marginBottom: 'var(--sp-4)', fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)' }}>
        <span style={{ color: 'var(--up)', fontWeight: 700 }}>▲ 上昇 {ups}枚</span>
        <span style={{ color: 'var(--down)', fontWeight: 700 }}>▼ 下落 {downs}枚</span>
        <span style={{ color: 'var(--ink-faint)' }}>横ばい {flats}枚</span>
        <span style={{ color: 'var(--ink-dim)' }}>
          中央値 {median > 0 ? '+' : ''}{median.toFixed(1)}%
        </span>
      </div>

      <div className="heat-wrap">
        {groups.map((g) => (
          <div key={g.boxId} className="heat-group">
            <Link href={`/boxes/${g.boxId}`} className="heat-label">{g.boxName}</Link>
            <div className="heat-cells">
              {g.cells.map((c) => (
                <Link
                  key={c.slug}
                  href={`/cards/${c.slug}`}
                  className={`heat-cell${c.change != null && c.change < 0 ? ' heat-down' : ''}`}
                  style={cellStyle(c.change)}
                  title={`${c.name} ${c.rarity}　¥${Math.round(c.mid).toLocaleString()}　${
                    c.change == null ? '前日比データなし' : `前日比 ${c.change > 0 ? '+' : ''}${c.change.toFixed(1)}%`
                  }`}
                  aria-label={`${c.name} ${c.rarity} ${c.change == null ? '前日比データなし' : `前日比 ${c.change.toFixed(1)}パーセント`}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 凡例。下落側のハッチは色覚に依らない手がかりなので必ずここにも出す */}
      <div className="heat-legend">
        <span>下落</span>
        {[4, 3, 2, 1, 0].map((lv) => (
          <span key={`d${lv}`} className="heat-key heat-down" style={{ background: `color-mix(in srgb, var(--down) ${MIX[lv]}%, var(--panel))` }} />
        ))}
        <span className="heat-key" style={{ background: 'var(--bg2)', border: '1px solid var(--hair)' }} />
        {[0, 1, 2, 3, 4].map((lv) => (
          <span key={`u${lv}`} className="heat-key" style={{ background: `color-mix(in srgb, var(--up) ${MIX[lv]}%, var(--panel))` }} />
        ))}
        <span>上昇</span>
        <span className="heat-legend-note">左端 −6%以上 / 右端 +6%以上・網掛けは下落・枠線のみは前日比なし</span>
      </div>
    </div>
  )
}
