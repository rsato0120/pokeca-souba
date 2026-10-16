import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { existingSnkrdunkBoxes, boxProductSeries, archivedBoxTransition } from './snkrdunk-box-price-policy'
import { priceChangePct } from '../src/lib/price-change'

test('registered BOX updates include Mercari histories, direct products and both variants', () => {
  const ids = { 'box-inferno_x-shrink': 687430, 'box-inferno_x-noshrink': 703025, 'box-test': 1, 'box-test-shrink': 2 }
  assert.deepEqual(existingSnkrdunkBoxes([{ id: 'box-inferno_x-shrink', latest: { date: '2026-10-11', low: 100, high: 100, source: 'mercari' } }], ids), ['inferno_x'])
  assert.deepEqual(boxProductSeries('test', ids), ['box-test', 'box-test-shrink'])
  assert.deepEqual(boxProductSeries('unknown', ids), [])
})

test('BOX migration preserves original history, archives same-day data and does not invent price changes', async () => {
  const cwd = process.cwd()
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'box-source-test-'))
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
  const original = { card_id: 'box-test', history: [
    { date: today, avg: 100, source: 'mercari' },
    { date: '2026-01-01', avg: 90, source: 'mercari' },
  ] }
  try {
    fs.mkdirSync(path.join(fixture, 'data/prices'), { recursive: true })
    fs.writeFileSync(path.join(fixture, 'data/snkrdunk-ids.json'), JSON.stringify({ 'box-test': 123, 'box-test-shrink': 124, 'box-test-noshrink': 125, 'box-single-shrink': 126 }))
    fs.writeFileSync(path.join(fixture, 'data/prices/box-test.json'), JSON.stringify(original))
    process.chdir(fixture)
    const { save, updateBox } = await import('./update-snkrdunk-box-prices')
    const sales = [{ date: today, unitPrice: 150, lot: 2 }]
    assert.equal(save('box-test', sales, 3), true)
    const read = () => JSON.parse(fs.readFileSync(path.join(fixture, 'data/prices/box-test.json'), 'utf8'))
    assert.equal(read().history[0].source, 'snkrdunk')
    assert.deepEqual(read().history[1], original.history[1])
    const registered = { 'box-test': 123 }
    assert.equal(archivedBoxTransition('box-test', read().history[0], read().history[1], registered), false)
    const archive = path.join(fixture, `data/price-source-archives/box-test/mercari-${today}.json`)
    assert.deepEqual(JSON.parse(fs.readFileSync(archive, 'utf8')), original)
    const snapshot = JSON.parse(fs.readFileSync(archive, 'utf8'))
    assert.equal(archivedBoxTransition('box-test', read().history[0], read().history[1], registered, snapshot), true)
    assert.equal(archivedBoxTransition('card-test', read().history[0], read().history[1], registered, snapshot), false)
    assert.equal(save('box-test', sales, 3), true)
    assert.equal(read().history.length, 2)
    assert.equal(read().sales_by_day[today], 2)
    assert.deepEqual(JSON.parse(fs.readFileSync(archive, 'utf8')), original)
    assert.equal(save('box-unknown', sales, 3), false)
    assert.equal(save('card-test', sales, 3), false)
    assert.equal(priceChangePct(read().history, 1, 100), null)
    const browser = {} as import('playwright').Browser
    const calls: number[] = []
    await updateBox(browser, 'test', async (_browser, id) => {
      calls.push(id)
      return { sales, complete: true }
    }, async () => 3)
    assert.deepEqual(calls, [123, 124, 125])
    await updateBox(browser, 'single', async () => ({ sales, complete: true }), async () => 3)
    assert.equal(fs.existsSync(path.join(fixture, 'data/prices/box-single-shrink.json')), true)
    assert.equal(fs.existsSync(path.join(fixture, 'data/prices/box-single.json')), false)
    await assert.rejects(updateBox(browser, 'test', async (_browser, id) => ({
      sales: id === 123 ? [] : sales, complete: id !== 123,
    }), async () => 3), /fetches failed/)
    assert.equal(save('box-test', [], 3), false)
    // A prior-day observation needs newer sales.
    const old = { card_id: 'box-test-shrink', history: [{ date: '2026-10-01', low: 100, high: 100, source: 'snkrdunk' }] }
    fs.writeFileSync(path.join(fixture, 'data/prices/box-test-shrink.json'), JSON.stringify(old))
    assert.equal(save('box-test-shrink', [{ date: '2026-09-30', unitPrice: 999, lot: 1 }], 3), false)
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(fixture, 'data/prices/box-test-shrink.json'), 'utf8')), old)
  } finally {
    process.chdir(cwd)
    fs.rmSync(fixture, { recursive: true, force: true })
  }
})
