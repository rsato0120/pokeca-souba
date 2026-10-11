import type { PriceRecord } from '../src/types/pokeca'

export function existingSnkrdunkBoxes(series: Array<{ id: string; latest?: PriceRecord }>): string[] {
  return [...new Set(series.filter(s => s.id.startsWith('box-') && s.latest?.source === 'snkrdunk')
    .map(s => s.id.slice(4).replace(/-(shrink|noshrink)$/, '')))]
}

export function hasNewBoxSales(previous: PriceRecord | undefined, dates: string[], today: string): boolean {
  return dates.length > 0 && (!previous || today === previous.date || dates.some(date => date > previous.date))
}
