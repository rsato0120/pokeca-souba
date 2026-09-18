import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'

export const metadata: Metadata = {
  title: '利用規約',
  description: '相場（SOUBA）の利用規約。AI予想・相場情報の正確性やご利用にあたっての注意事項。',
}

export default function TermsPage() {
  return (
    <main className="wrap legal-page">
      <Link prefetch={false} className="legal-back" href="/">← トップへ戻る</Link>
      <SiteHeader />
      <h1>利用規約</h1>
      <p>本規約は、相場（SOUBA）（以下「当サイト」）の利用条件を定めるものです。当サイトをご利用の際は、以下の内容をご確認ください。</p>
      <section>
        <h2>1. 当サイトが提供する情報</h2>
        <p>当サイトは、トレーディングカードや未開封BOXの相場情報、ランキング、AIによる価格予想などを参考情報として提供します。特定の商品や取引の推奨、投資・売買の助言を目的とするものではありません。</p>
      </section>
      <section className="legal-notice">
        <h2>2. 予想の正確性について</h2>
        <p><strong>AIによる予想は必ずしも正確ではなく、実際の価格や値動きと異なる場合があります。</strong>予想価格帯、上昇・下落の見通し、評価、ランキングなどの正確性・完全性を保証するものではありません。</p>
        <p>過去の価格推移や予想の的中実績は、将来の価格、予想の的中、利益を保証しません。市場環境、再販、商品の状態、需給などにより、価格は大きく変動することがあります。</p>
      </section>
      <section>
        <h2>3. 相場情報と売買の判断</h2>
        <p>掲載価格には取得時点との差、更新の遅れ、誤りが含まれる場合があり、実際にその価格で購入・売却できることを保証しません。取引前に販売店・取引先で最新の価格、在庫、商品の状態、手数料などをご確認ください。</p>
        <p>売買の判断は、当サイトの情報だけに依存せず、ご自身の判断と責任で行ってください。</p>
      </section>
      <section>
        <h2>4. 責任の範囲</h2>
        <p>当サイトの情報の利用により生じた損失・損害について、運営者は法令で認められる範囲で責任を負わないものとします。ただし、運営者の故意または重大な過失による場合や、法令上免責が認められない場合を除きます。</p>
      </section>
      <section>
        <h2>5. ご利用にあたって</h2>
        <p>法令や第三者の権利を侵害する行為、虚偽の情報や誹謗中傷の投稿、当サイトの運営を妨げる行為は禁止します。外部リンク先のサービスは、それぞれの利用条件をご確認のうえご利用ください。</p>
      </section>
      <section>
        <h2>6. サービス・規約の変更</h2>
        <p>当サイトは、情報の修正・更新や、サービス内容の変更・中断・終了を行う場合があります。本規約を改定する場合は、変更内容と適用日を当サイトに掲載し、法令上必要な手続きに従います。</p>
      </section>
      <section>
        <h2>7. お問い合わせ・個人情報の取り扱い</h2>
        <p>本規約に関するご連絡は<Link prefetch={false} href="/contact">お問い合わせ</Link>をご確認ください。個人情報等の取り扱いは<Link prefetch={false} href="/privacy">プライバシーポリシー</Link>に定めます。</p>
      </section>
      <p className="legal-date">制定・適用日：2026年9月18日</p>
    </main>
  )
}
