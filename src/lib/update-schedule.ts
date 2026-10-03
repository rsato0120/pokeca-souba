export const MARKET_UPDATE_HOURS_JST = [10, 23] as const
export const POKEMON_UPDATE_MINUTE_JST = 17
export const ONEPIECE_UPDATE_MINUTE_JST = 47

/** Scheduled start, not completion: fetching and publishing take additional time. */
export function getNextMarketUpdateMs(now: number, minute = POKEMON_UPDATE_MINUTE_JST): number {
  const jstNow = now + 9 * 3600_000
  const dayStart = Math.floor(jstNow / 86400_000) * 86400_000
  for (let day = 0; day <= 1; day++) {
    for (const hour of MARKET_UPDATE_HOURS_JST) {
      const scheduled = dayStart + day * 86400_000 + hour * 3600_000 + minute * 60_000
      if (scheduled > jstNow) return scheduled - 9 * 3600_000
    }
  }
  return now
}
