'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, isActiveTab } from '@/lib/nav'

// スマホ用の下部固定タブ。PCでは CSS で非表示（globals.css の .bottom-tabs）。
//
// ⚠ 固定要素なので、本文の下に必ず余白を作る（globals.css で .wrap の padding-bottom を
//   タブの高さ + safe-area ぶん確保している）。これが無いと最後のセクションやボタンが
//   タブの下に潜って押せなくなる。
// ⚠ アクセシビリティ: 現在タブに aria-current="page" を付ける。リンクなのでキーボードの
//   Tab/Enter でそのまま辿れる（role や tabIndex を足して素の挙動を壊さない）。

export default function BottomTabs() {
  const pathname = usePathname()

  return (
    <nav className="bottom-tabs" aria-label="メインナビゲーション">
      {NAV_ITEMS.map((item) => {
        const active = isActiveTab(item, pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-tab${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="bottom-tab-icon" aria-hidden="true">{item.icon}</span>
            <span className="bottom-tab-label">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
