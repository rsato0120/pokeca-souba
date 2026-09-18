import Link from 'next/link'

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav aria-label="サイト情報">
        <Link prefetch={false} href="/terms">利用規約</Link>
        <Link prefetch={false} href="/contact">お問い合わせ</Link>
        <Link prefetch={false} href="/privacy">プライバシーポリシー</Link>
      </nav>
      <p>AIによる予想は参考情報です。正確性や将来の価格を保証するものではありません。</p>
      <small>相場（SOUBA）</small>
    </footer>
  )
}
