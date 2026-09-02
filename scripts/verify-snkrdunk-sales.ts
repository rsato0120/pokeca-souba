import assert from 'node:assert/strict'
import { parseSnkrdunkSaleDate } from './snkrdunk-sales'

// 2026-09-02 01:30 JST。JSTの日付境界をまたぐ相対表記を固定して検証する。
const now = Date.parse('2026-09-02T01:30:00+09:00')

assert.equal(parseSnkrdunkSaleDate('2026/08/31', now), '2026-08-31')
assert.equal(parseSnkrdunkSaleDate('30分前', now), '2026-09-02')
assert.equal(parseSnkrdunkSaleDate('2時間前', now), '2026-09-01')
assert.equal(parseSnkrdunkSaleDate('1日前', now), '2026-09-01')
assert.equal(parseSnkrdunkSaleDate('不明', now), null)

console.log('snkrdunk sales date parser: OK')
