'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from './ThemeToggle'
import { NAV_ITEMS, isActiveTab } from '@/lib/nav'

// 全ページ共通のヘッダー。
//
// ⚠ 2026-08-28 まで、同じ markup が9ページに**コピーで散っていた**（トップ・BOX・カード詳細・
//   ランキング・スクリーナー・ウォッチリスト・マイコレクション・AI的中・プライバシー）。
//   ナビを1本足すたびに9ファイル直す必要があり、実際どのページにも導線が無かった。ここに集約する。
//
// ナビは**実在するルートだけ**を出す。`/boxes` は [boxId] しか無く一覧ページが無いので入れない
// （トップのドロップダウンから選ぶ導線が既にある）。行き先の無いタブを飾りで置かない。

// ⚠ タブの定義は src/lib/nav.ts に集約（2026-08-30）。
//   スマホの下部固定タブ（BottomTabs）と**同じ定義**を使う。片方だけ増やすと導線が食い違う。
//   ホーム / AI予想 / ランキング / マイページ の4本。既存の /screener・/watchlist・
//   /portfolio・/accuracy はURLを残したまま、この4タブの配下から到達させている。
export default function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="site-header">
      <Link href="/" className="logo-link">
        <span className="logo">相場</span>
      </Link>

      <nav className="site-nav" aria-label="メインナビゲーション">
        {NAV_ITEMS.map((item) => {
          const active = isActiveTab(item, pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`site-nav-item${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <Link href="/screener" className="site-search-link" aria-label="カード検索">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <line x1="15.4" y1="15.4" x2="20.5" y2="20.5" />
        </svg>
      </Link>
      <ThemeToggle />
    </header>
  )
}
