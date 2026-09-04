import type { Metadata } from 'next'

export const metadata: Metadata = {
  description: 'ONE PIECEカードの高額カードと未開封BOXを、スニダンの実成約から確認。OP-13〜OP-17の相場・価格推移を掲載。',
  openGraph: {
    title: '相場 — ONE PIECEカード・BOX相場',
    description: '高額カードと未開封BOXのスニダン成約相場・価格推移。',
    url: 'https://pokeca-souba.vercel.app/onepiece',
    siteName: '相場',
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '相場 — ONE PIECEカード・BOX相場',
    description: 'OP-13〜OP-17の高額カードと未開封BOXの相場をチェック。',
  },
}
export default function Layout({ children }: { children: React.ReactNode }) { return children }
