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

export const metadata: Metadata = {
  title: '相場 — ポケモンカード相場予想',
  description: 'AIがポケモンカードの価値を読み解く。現在相場と今後の予想を根拠つきで提供。',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${mincho.variable} ${mono.variable} ${gothic.variable}`}>
      <body>{children}</body>
    </html>
  )
}
