'use client'

import { isBoxReleased } from '@/lib/box-release'
import type { Certainty } from '@/types/pokeca'

export default function BoxReleaseStatus({ certainty, releaseDate, releaseYm }: { certainty: Certainty; releaseDate?: string; releaseYm: string }) {
  return <span>{isBoxReleased({ certainty, release_date: releaseDate }) ? '発売' : '発売予定'} {releaseYm}</span>
}
