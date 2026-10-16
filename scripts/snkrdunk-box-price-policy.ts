import type { PriceHistory, PriceRecord } from '../src/types/pokeca'

export function existingSnkrdunkBoxes(series: Array<{ id: string; latest?: PriceRecord }>, ids: Record<string, number> = {}): string[] {
  return [...new Set(series.filter(s => s.id.startsWith('box-') && (s.latest?.source === 'snkrdunk' || ids[s.id] != null))
    .map(s => s.id.slice(4).replace(/-(shrink|noshrink)$/, '')))]
}

export function boxProductSeries(boxId: string, ids: Record<string, number>): string[] {
  return [`box-${boxId}`, `box-${boxId}-shrink`, `box-${boxId}-noshrink`].filter(id => ids[id] != null)
}

export function registeredBoxSeries(id: string, ids: Record<string, number>): boolean {
  return id.startsWith('box-') && Boolean(ids[id] || (ids[id + '-shrink'] && ids[id + '-noshrink']))
}

// An archived, deliberate BOX transition is not a same-market price change.
export function archivedBoxTransition(id: string, current: PriceRecord, previous: PriceRecord,
  ids: Record<string, number>, archive?: PriceHistory): boolean {
  return registeredBoxSeries(id, ids) && current.source === 'snkrdunk' && previous.source === 'mercari'
    && archive?.card_id === id && archive.history[0]?.source === 'mercari'
    && archive.history[0].date <= current.date
    && archive.history.some(r => r.date === previous.date && r.source === previous.source
      && r.avg === previous.avg && r.low === previous.low && r.high === previous.high)
}

export function hasNewBoxSales(previous: PriceRecord | undefined, dates: string[], today: string): boolean {
  return dates.length > 0 && (!previous || today === previous.date || dates.some(date => date > previous.date))
}
