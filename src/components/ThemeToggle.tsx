'use client'

export const THEME_KEY = 'pokeca-theme-v1'

// テーマ切替ボタン。
// ⚠ 初期テーマの決定は layout.tsx の先読みスクリプト（描画前に data-theme を書く）が担当する。
//    ここで決めると、SSRのHTML＝ライトが一瞬出てからダークに変わる（白い閃光）。
// ⚠ 「今どちらか」を state で持たないこと。マウント後にしか確定しないので、
//    ボタンが遅れて現れてヘッダが揺れる。ラベルは両方SSRで描いて CSS
//    （:root[data-theme='dark']）に出し分けさせる＝ズレもちらつきも起きない。
export default function ThemeToggle() {
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => {
        const root = document.documentElement
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
        root.setAttribute('data-theme', next)
        try {
          localStorage.setItem(THEME_KEY, next)
        } catch {
          // プライベートモード等で保存できなくても、その場の切替は効かせる
        }
      }}
      aria-label="ライト／ダークを切り替える"
      title="ライト／ダークを切り替える"
    >
      <span className="t-on-light" aria-hidden="true">☾</span>
      <span className="t-on-light">DARK</span>
      <span className="t-on-dark" aria-hidden="true">☀</span>
      <span className="t-on-dark">LIGHT</span>
    </button>
  )
}
