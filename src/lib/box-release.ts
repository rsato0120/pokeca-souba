import type { Box } from '@/types/pokeca'

export function todayJst(now = Date.now()): string {
  return new Date(now + 9 * 3600000).toISOString().slice(0, 10)
}

/** 発売日の0時（日本時間）から発売済みとして扱う。 */
export function isBoxReleased(box: Pick<Box, 'certainty' | 'release_date'>, now = Date.now()): boolean {
  if (box.certainty === 'released') return true
  return box.certainty === 'announced' && box.release_date != null && box.release_date <= todayJst(now)
}
