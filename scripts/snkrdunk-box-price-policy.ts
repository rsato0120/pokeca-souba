import type { PriceRecord } from '../src/types/pokeca'

export function existingSnkrdunkBoxes(series: Array<{ id: string; latest?: PriceRecord }>, ids: Record<string, number> = {}): string[] {
  return [...new Set(series.filter(s => s.id.startsWith('box-') && (s.latest?.source === 'snkrdunk' || ids[s.id] != null))
    .map(s => s.id.slice(4).replace(/-(shrink|noshrink)$/, '')))]
}

export function boxProductSeries(boxId: string, ids: Record<string, number>): string[] {
  return [`box-${boxId}`, `box-${boxId}-shrink`, `box-${boxId}-noshrink`].filter(id => ids[id] != null)
}

export function hasNewBoxSales(previous: PriceRecord | undefined, dates: string[], today: string): boolean {
  return dates.length > 0 && (!previous || today === previous.date || dates.some(date => date > previous.date))
}
