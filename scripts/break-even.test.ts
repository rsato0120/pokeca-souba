import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateBreakEven } from '../src/lib/break-even'

test('送料・鑑定費・手数料込みの売却損益と端数切り上げ', () => {
  const costs = { purchase: 10000, expenses: 1000, shipping: 750, feePct: 10 }
  const r = calculateBreakEven(costs, 15000)!
  assert.equal(r.breakEven, 13056)
  assert.equal(r.proceeds, 12750)
  assert.equal(r.profit, 1750)
  assert.ok(calculateBreakEven(costs, r.breakEven)!.profit! >= 0)
  assert.ok(calculateBreakEven(costs, r.breakEven - 1)!.profit! < 0)
})
test('相場欠測・手数料なし・無効入力', () => {
  const costs = { purchase: 10000, expenses: 0, shipping: 0, feePct: 0 }
  assert.deepEqual(calculateBreakEven(costs, null), { breakEven: 10000, proceeds: null, profit: null })
  assert.equal(calculateBreakEven(costs, 0)!.profit, null)
  for (const bad of [{ feePct: 100 }, { purchase: -1 }, { expenses: NaN }, { shipping: Infinity }]) {
    assert.equal(calculateBreakEven({ ...costs, ...bad }, 12000), null)
  }
})
