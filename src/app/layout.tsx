import type { Metadata } from 'next'
import { Shippori_Mincho, JetBrains_Mono, Zen_Kaku_Gothic_New } from 'next/font/google'
import './globals.css'

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
    <html lang="ja" className={`${mincho.variable} ${mono.variable} ${gothic.variable}`}>
      <body>{children}</body>
    </html>
  )
}
