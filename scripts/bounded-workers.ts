/** Await every worker before returning, including when one item fails. */
export async function forEachBounded<T>(items: readonly T[], concurrency: number, visit: (item: T) => Promise<void>): Promise<void> {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 3) {
    throw new Error('SCRAPE_CONCURRENCY must be an integer from 1 to 3')
  }
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++]
      await visit(item)
    }
  })
  const results = await Promise.allSettled(workers)
  const errors = results.filter(result => result.status === 'rejected')
  if (errors.length) throw new AggregateError(errors.map(result => result.reason), 'Scrape workers failed')
}
