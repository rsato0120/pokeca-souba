import Link from 'next/link'
import type { Metadata } from 'next'
import ThemeToggle from '@/components/ThemeToggle'

export const metadata: Metadata = {
  title: 'プライバシーポリシー',
  description: '相場（SOUBA）のプライバシーポリシー・免責事項。',
}

const SECTION: React.CSSProperties = { marginBottom: '22px' }
const H2: React.CSSProperties = { fontFamily: 'var(--mincho)', fontSize: '16px', fontWeight: 700, marginBottom: '8px' }
const P: React.CSSProperties = { fontSize: '13px', color: 'var(--ink-dim)', lineHeight: 1.9 }

export default function PrivacyPage() {
  return (
    <div className="wrap" style={{ maxWidth: '720px' }}>
      <Link
        href="/"
        style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-faint)', letterSpacing: '0.06em', display: 'inline-block', padding: '18px 0 10px' }}
      >
        ← トップへ戻る
      </Link>
      <header className="site-header">
        <div className="logo">相場</div>
        <div className="tagline">ポケモンカードの価値を、AIが読み解く</div>
        <ThemeToggle />
      </header>

      <h1 style={{ fontFamily: 'var(--mincho)', fontSize: '24px', fontWeight: 800, margin: '24px 0 18px' }}>
        プライバシーポリシー
      </h1>

      <div style={SECTION}>
        <h2 style={H2}>運営方針</h2>
        <p style={P}>
          相場（SOUBA）（以下「当サイト」）は、ポケモンカードの相場情報とAIによる予想を提供する情報サイトです。
          当サイトは利用者のプライバシーを尊重し、以下の方針に基づいて個人情報・データを取り扱います。
        </p>
      </div>

      <div style={SECTION}>
        <h2 style={H2}>当サイトが扱うデータ</h2>
        <p style={P}>
          当サイトはアカウント登録を必要とせず、氏名・住所・電話番号などの個人情報を取得しません。
          「マイコレクション」で登録した所持カードの情報は、お使いの端末のブラウザ内（localStorage）にのみ保存され、
          当サイトのサーバーには送信・保存されません。
        </p>
      </div>

      <div style={SECTION}>
        <h2 style={H2}>広告の配信について</h2>
        <p style={P}>
          当サイトは第三者配信の広告サービスを利用する場合があります。これらの広告配信事業者は、利用者の興味に応じた
          広告を表示するためにCookie等を使用することがあります。Cookieを無効にする設定はブラウザの設定から行えます。
          第三者によるCookieの利用については、各事業者のポリシーをご確認ください。
        </p>
      </div>

      <div style={SECTION}>
        <h2 style={H2}>アフィリエイトプログラムについて</h2>
        <p style={P}>
          当サイトはA8.netをはじめとするアフィリエイトプログラムを利用しており、商品・サービスを紹介するリンクを掲載しています。
          これらのリンクを経由して購入が行われた場合、当サイトが紹介料を得ることがあります。価格や在庫は各販売サイトの表示が優先されます。
        </p>
      </div>

      <div style={SECTION}>
        <h2 style={H2}>免責事項</h2>
        <p style={P}>
          当サイトの相場・AI予想は公開情報をもとに生成した参考情報であり、正確性・将来の価格を保証するものではありません。
          投資・売買を助言するものではなく、これらの情報に基づく判断・行動はご自身の責任で行ってください。
          当サイトの利用により生じたいかなる損害についても、当サイトは責任を負いません。
        </p>
      </div>

      <div style={SECTION}>
        <h2 style={H2}>お問い合わせ</h2>
        <p style={P}>
          本ポリシーに関するお問い合わせは、当サイト運営者のSNS（X）までご連絡ください。
          {/* TODO: 連絡先（X等）を設定 */}
        </p>
      </div>

      <p style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-faint)', marginTop: '20px' }}>
        制定日: 2026-06-25
      </p>
    </div>
  )
}
