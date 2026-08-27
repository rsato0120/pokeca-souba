import type { Metadata } from 'next'
import { Shippori_Mincho, JetBrains_Mono, Zen_Kaku_Gothic_New } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const GA_ID = 'G-NTDWVBC7SW'

const mincho = Shippori_Mincho({
  weight: ['500', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-mincho',
})

const mono = JetBrains_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-mono',
})

const gothic = Zen_Kaku_Gothic_New({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-gothic',
})

const SITE_URL = 'https://pokeca-souba.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '相場 — ポケモンカード相場予想',
    template: '%s | 相場',
  },
  description: 'AIがポケモンカードの価値を読み解く。SR・SAR・MURなどのレアカードを対象に、現在相場と今後1〜2ヶ月の価格予想を根拠つきで提供。',
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    siteName: '相場',
    url: SITE_URL,
    title: '相場 — ポケモンカード相場予想',
    description: 'AIがポケモンカードの価値を読み解く。SR・SAR・MURなどのレアカードの現在相場と今後の予想を根拠つきで提供。',
  },
  twitter: {
    card: 'summary_large_image',
    title: '相場 — ポケモンカード相場予想',
    description: 'AIがポケモンカードの価値を読み解く。SR・SAR・MURなどのレアカードの現在相場と今後の予想を根拠つきで提供。',
  },
  robots: { index: true, follow: true },
  verification: {
    google: 'CtzuiJ9k92BnHvdPQHZj__PgbgWRhs2n-JzRPzZOBQc',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ja"
      className={`${mincho.variable} ${mono.variable} ${gothic.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* テーマの先読み。描画前に data-theme を確定させないと、
            SSRの配色が一瞬出てから切り替わる（白い閃光）。
            保存された選択 > OS設定 > ダーク の順。
            ⚠ 既定をダークにしている（2026-08-28）。相場アプリはダークが標準的で、
            OSが「ライト」と明示している人にはライトのままなので押し付けにはならない。
            matchMedia('(prefers-color-scheme: light)') が真の時だけライトにする＝
            no-preference の環境はダークに倒れる。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('pokeca-theme-v1');var d=s==='dark'||s==='light'?s:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',d);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="ga4-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}</Script>
      </head>
      <body>{children}</body>
    </html>
  )
}
