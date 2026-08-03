import type { MetadataRoute } from 'next'
import { getAllCards, getAllBoxes, getCardSlug } from '@/lib/data'

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
      url: `${SITE_URL}/ranking`,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    ...cardUrls,
    ...boxUrls,
  ]
}
