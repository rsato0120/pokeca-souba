import { createHash } from 'node:crypto'
import issuedLinks from '../../data/mercari-x-links.json'

const SITE = 'https://pokeca-souba.vercel.app'

// BOXもA8画面で発行したX専用URLだけを使う。
export function mercariBoxXShareUrl(boxId: string): string | null {
  return (issuedLinks as Record<string, { url: string }>)[`box-${boxId}`]?.url ?? null
}

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
  // 新規BW・PCGデルタ種・SM12はリンク未発行。共有文から広告リンクを省く。
  if (!entry && (cardId.startsWith('bw-') || /^(pcg[6-9]-|pmcg1-|mg-)/.test(cardId) || cardId.startsWith('alter-genesis-'))) return null
  if (!entry) throw new Error(`Missing issued Mercari X link for ${cardId}`)
  return entry.url
}
