'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from './ThemeToggle'

// 全ページ共通のヘッダー。
//
// ⚠ 2026-08-28 まで、同じ markup が9ページに**コピーで散っていた**（トップ・BOX・カード詳細・
//   ランキング・スクリーナー・ウォッチリスト・マイコレクション・AI的中・プライバシー）。
//   ナビを1本足すたびに9ファイル直す必要があり、実際どのページにも導線が無かった。ここに集約する。
//
// ナビは**実在するルートだけ**を出す。`/boxes` は [boxId] しか無く一覧ページが無いので入れない
// （トップのドロップダウンから選ぶ導線が既にある）。行き先の無いタブを飾りで置かない。

// ⚠ 6項目から4項目に減らした（2026-08-30）。
//   /ranking … スクリーナー(/screener)に並び替えがあり役割が重なるので外す
//   /accuracy … トップの「AI予想の的中率」から直接リンクしているので外す
//   どちらもページ自体は残しており、URLでも各所のリンクからでも到達できる。
const NAV = [
  { href: '/', label: 'トップ' },
  { href: '/screener', label: 'カード検索' },
  { href: '/watchlist', label: 'ウォッチ' },
  { href: '/portfolio', label: 'コレクション' },
] as const

export default function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="site-header">
      <Link href="/" className="logo-link">
        <span className="logo">相場</span>
      </Link>

      <nav className="site-nav">
        {NAV.map(({ href, label }) => {
          // トップだけは完全一致。他は配下ページ（/cards/xxx 等）でも親タブを点灯させたいので前方一致
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link key={href} href={href} className={`site-nav-item${active ? ' is-active' : ''}`}>
              {label}
            </Link>
          )
        })}
      </nav>

      <ThemeToggle />
    </header>
  )
}
