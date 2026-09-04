import type { MetadataRoute } from 'next'
import { getAllCards, getAllBoxes, getCardSlug } from '@/lib/data'
import { getOnePieceCatalog } from '@/lib/onepiece'

const SITE_URL = 'https://pokeca-souba.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const cards = getAllCards()
  const boxes = getAllBoxes()

  const cardUrls = cards.map((card) => ({
    url: `${SITE_URL}/cards/${getCardSlug(card)}`,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  const boxUrls = boxes.map((box) => ({
    url: `${SITE_URL}/boxes/${box.box_id}`,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  return [
    {
      url: SITE_URL,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      // 全カードを横断できる唯一の一覧。カード詳細への内部リンクがここに集まるので、
      // トップに次ぐ優先度を与える
      url: `${SITE_URL}/screener`,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/ranking`,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/accuracy`,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    ...cardUrls,
    ...boxUrls,
    ...['/onepiece', '/onepiece/cards', '/onepiece/boxes',
      ...getOnePieceCatalog().sets.map(s => `/onepiece/sets/${s.id}`),
      ...getOnePieceCatalog().products.map(p => `/onepiece/products/${p.id}`),
    ].map(route => ({ url: `${SITE_URL}${route}`, changeFrequency: 'daily' as const, priority: .7 })),
  ]
}
