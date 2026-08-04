// 一覧の各行に添える極小の折れ線。直近数点の「形」だけを見せる。
//
// サーバーコンポーネント: 線を引くアニメーションは pathLength と dasharray でCSSに書けるので
// JSを足さない（ティッカーと同じ方針）。
//
// 値そのものは必ず隣にテキストで出ている前提なので、図は支援技術から隠す。
// 目盛りも軸もラベルも置かない（この大きさでは読めず、行を汚すだけ）。

export default function Sparkline({
  values,
  width = 72,
  height = 22,
  animate = true,
}: {
  values: number[]          // 古い順
  width?: number
  height?: number
  animate?: boolean
}) {
  if (values.length < 2) return null

  const pad = 2
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min

  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2)
  // 全点が同値なら中央に水平線を引く（下端に貼り付くと「暴落した」ように見える）
  const y = (v: number) =>
    span === 0 ? height / 2 : height - pad - ((v - min) / span) * (height - pad * 2)

  const line = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ')
  const area = `${line} L${x(values.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`

  const first = values[0]
  const last = values[values.length - 1]
  const color = last > first ? 'var(--up)' : last < first ? 'var(--down)' : 'var(--flat)'

  return (
    <svg
      className="spark"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ display: 'block', color, overflow: 'visible' }}
    >
      <path d={area} fill="currentColor" opacity={0.1} />
      <path
        // pathLength を固定すると、実際の長さに関係なく dasharray 100 で描画量を制御できる
        pathLength={100}
        className={animate ? 'spark-path' : undefined}
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x(values.length - 1)} cy={y(last)} r={2.1} fill="currentColor" />
    </svg>
  )
}
