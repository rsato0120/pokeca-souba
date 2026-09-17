import Link from 'next/link'

export default function GameTabs({ game }: { game: 'pokemon' | 'onepiece' }) {
  return <nav className="game-tabs" aria-label="カードゲームを切り替え">
    <Link prefetch={false} href="/" aria-current={game === 'pokemon' ? 'page' : undefined}>ポケモンカード</Link>
    <Link prefetch={false} href="/onepiece" aria-current={game === 'onepiece' ? 'page' : undefined}>ONE PIECEカード</Link>
  </nav>
}
