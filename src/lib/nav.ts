// サイトの主要タブ。PC は上部ナビ（SiteHeader）、スマホは下部固定タブ（BottomTabs）で
// **同じ定義**を使う。片方だけ増えると導線が食い違うので、必ずここを1箇所直す。
//
// ⚠ 既存URLは消していない。/screener（詳細検索）・/watchlist・/portfolio・/accuracy は
//   そのまま生きていて、下の4タブ配下から到達できるようにしてある。
//   （SEOのため既存のパスを変えない。マイページは新設だが、中身は既存2ページへの入口）

export interface NavItem {
  href: string
  label: string
  /** 下部タブに出すアイコン（絵文字。SVGを持ち込むほどの情報量ではない） */
  icon: string
  /** このタブが担当する配下のパス。現在タブの判定に使う */
  owns: string[]
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'ホーム', icon: '🏠', owns: ['/boxes', '/cards'] },
  { href: '/ai', label: 'AI予想', icon: '🤖', owns: ['/accuracy'] },
  { href: '/ranking', label: 'ランキング', icon: '📊', owns: [] },
  { href: '/mypage', label: 'マイページ', icon: '📁', owns: ['/watchlist', '/portfolio', '/screener'] },
]

/** 現在のパスがどのタブに属するか。トップだけ完全一致、他は前方一致＋owns */
export function isActiveTab(item: NavItem, pathname: string): boolean {
  if (item.href === '/') {
    return pathname === '/' || item.owns.some((p) => pathname.startsWith(p))
  }
  if (pathname === item.href || pathname.startsWith(item.href + '/')) return true
  return item.owns.some((p) => pathname === p || pathname.startsWith(p + '/'))
}
