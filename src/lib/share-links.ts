import { createHash } from 'node:crypto'
import issuedLinks from '../../data/mercari-x-links.json'

const SITE = 'https://pokeca-souba.vercel.app'

// カードIDから安定した短縮キーを作る。カタログの並び順が変わってもリンクを維持する。
export function cardShareToken(cardId: string): string {
  return createHash('sha256').update(cardId).digest('hex').slice(0, 12)
}

export function cardShareUrl(cardId: string): string {
  return `${SITE}/s/${cardShareToken(cardId)}`
}

// A8の作成画面でカードごとに発行したX用URLを改変せずに使用する。
export function mercariXShareUrl(cardId: string): string | null {
  const entry = (issuedLinks as Record<string, { url: string; destination: string }>)[cardId]
  // 新規BWカードはリンク未発行。共有文から広告リンクを省き、既存カードの検証は維持する。
  if (!entry && cardId.startsWith('bw-')) return null
  if (!entry) throw new Error(`Missing issued Mercari X link for ${cardId}`)
  return entry.url
}
