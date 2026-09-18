import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'

export const metadata: Metadata = {
  title: 'お問い合わせ',
  description: '相場（SOUBA）へのお問い合わせは、XのpokecaAI（@pokecaAI）までご連絡ください。',
}

export default function ContactPage() {
  return (
    <main className="wrap legal-page">
      <Link prefetch={false} className="legal-back" href="/">← トップへ戻る</Link>
      <SiteHeader />
      <h1>お問い合わせ</h1>
      <p>当サイトへのご質問、不具合の報告、掲載情報の修正のご連絡は、Xの「pokecaAI」までお願いします。</p>
      <section className="legal-notice">
        <h2>お問い合わせ先</h2>
        <p>pokecaAI（@pokecaAI）</p>
        <a className="contact-link" href="https://x.com/pokecaAI" target="_blank" rel="noopener noreferrer">Xで pokecaAI を開く ↗</a>
        <p>プロフィールからお問い合わせください。Xは新しいタブで開きます。</p>
      </section>
      <section>
        <h2>お問い合わせの際に</h2>
        <p>該当するページのURLと、お問い合わせ内容をお知らせください。不具合の場合は、ご利用の端末・ブラウザと発生した状況も添えていただくと確認がスムーズです。</p>
        <p>公開の投稿には、氏名・住所・電話番号などの個人情報を記載しないでください。</p>
      </section>
    </main>
  )
}
