'use client'
import { useEffect, useRef, useState } from 'react'

// 金額を数え上げる。数字だけはCSSで動かせないのでここだけクライアントにする。
//
// ⚠ 「読み込んだら数え上げる」にしてはいけない。
//   SSRは最終値を描くので（JS無効でも¥0が出ないようにするため必須）、hydrationが終わる
//   まで約0.25秒は正しい価格が画面に出ている。そこから0に戻して数え直すと、
//   **正しい値 → ¥377 → …→ 正しい値** と動いて価格が壊れたように見える。
//   useLayoutEffect にしても hydration 自体の待ち時間は縮まらないので解決しない。
//
// なので「読み込み時点で画面外にあった要素が、スクロールで入ってきた時だけ」数える。
// 最初から見えていた要素は既に最終値を見られているので、そのまま静止させる。
export default function CountUp({
  value,
  durationMs = 800,
  prefix = '',
}: {
  value: number
  durationMs?: number
  prefix?: string
}) {
  const [display, setDisplay] = useState(value)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || value <= 0) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    // 読み込み時点で画面内なら何もしない（最終値を見せたまま）
    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight && rect.bottom > 0) return

    let raf = 0
    const io = new IntersectionObserver((entries) => {
      if (!entries.some(e => e.isIntersecting)) return
      io.disconnect()
      const t0 = performance.now()
      // 終盤ほど減速させる（ease-out-cubic）。等速だと止まる瞬間が分かりにくい
      const ease = (t: number) => 1 - Math.pow(1 - t, 3)
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / durationMs)
        setDisplay(Math.round(value * ease(t)))
        if (t < 1) raf = requestAnimationFrame(tick)
      }
      setDisplay(0)
      raf = requestAnimationFrame(tick)
    })
    io.observe(el)

    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [value, durationMs])

  return <span ref={ref}>{prefix}{display.toLocaleString()}</span>
}
