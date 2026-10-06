import { createHash } from 'node:crypto'

const SITE = 'https://pokeca-souba.vercel.app'

// カードIDから安定した短縮キーを作る。カタログの並び順が変わってもリンクを維持する。
export function cardShareToken(cardId: string): string {
  return createHash('sha256').update(cardId).digest('hex').slice(0, 12)
}

export function cardShareUrl(cardId: string): string {
  return `${SITE}/s/${cardShareToken(cardId)}`
}

// A8のSNS・note用 → Xで発行されたURLをそのまま使用する。
export const MERCARI_X_AFFILIATE_URL = 'https://r.8to.jp/4adEG7LLwG86'
