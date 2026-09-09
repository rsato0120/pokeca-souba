import assert from 'node:assert/strict'
import { test } from 'node:test'
import { forEachBounded } from './bounded-workers'

test('all products run exactly once with at most three active requests', async () => {
  let active = 0
  let peak = 0
  const completed: number[] = []
  await forEachBounded(Array.from({ length: 11 }, (_, i) => i), 3, async item => {
    peak = Math.max(peak, ++active)
    await new Promise(resolve => setTimeout(resolve, 2))
    completed.push(item)
    active--
  })
  assert.equal(peak, 3)
  assert.equal(active, 0)
  assert.deepEqual(completed.sort((a, b) => a - b), Array.from({ length: 11 }, (_, i) => i))
})

test('a failed request cannot close the browser while other workers are saving', async () => {
  const completed: number[] = []
  await assert.rejects(forEachBounded([0, 1, 2, 3], 2, async item => {
    if (item === 0) throw new Error('request failed')
    await new Promise(resolve => setTimeout(resolve, 2))
    completed.push(item)
  }), AggregateError)
  assert.deepEqual(completed, [1, 2, 3])
})

test('invalid concurrency fails before making requests', async () => {
  for (const value of [0, -1, 4, 1.5, NaN, Infinity]) {
    await assert.rejects(forEachBounded([], value, async () => assert.fail('unexpected request')))
  }
})

test('one BOX keeps shrink, noshrink, and mixed observations in order', async () => {
  const saved = new Map<number, string[]>()
  await forEachBounded([1, 2, 3], 3, async box => {
    const observations: string[] = []
    saved.set(box, observations)
    for (const variant of ['shrink', 'noshrink', 'mixed']) {
      await new Promise(resolve => setTimeout(resolve, 1))
      observations.push(variant)
    }
  })
  for (const observations of saved.values()) assert.deepEqual(observations, ['shrink', 'noshrink', 'mixed'])
})
