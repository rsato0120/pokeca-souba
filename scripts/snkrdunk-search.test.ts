import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Browser } from 'playwright'
import { findSnkrdunkId, parseCardNo, selectSnkrdunkId } from './scrape-prices'

const link = (id: number, text: string) => ({ href: `https://snkrdunk.com/apparels/${id}`, text })
const lillie = 'リーリエのピッピex SAR [SV9 126/100](拡張パック「バトルパートナーズ」)'
const zoroark = 'Nのゾロアークex UR [SV9 131/100](拡張パック「バトルパートナーズ」)'

test('Japanese Lillie remains unique when Chinese and English products are returned', () => {
  assert.equal(selectSnkrdunkId([
    link(505956, lillie), link(505956, 'PSA10\n' + lillie),
    link(535520, 'リーリエのピッピex SAR [SV9F 126/100]【中国語版】'),
    link(554381, 'リーリエのピッピex SIR [JTG EN 184/159]【英語版】'),
  ], 'リーリエのピッピex', 'SAR', parseCardNo('126/100')), 505956)
})

test('error Zoroark is a separate product even with the same name, rarity and number', () => {
  assert.equal(selectSnkrdunkId([
    link(506160, zoroark), link(524253, zoroark.replace(' UR', ' :エラー版 UR')),
  ], 'Nのゾロアークex', 'UR', parseCardNo('131/100')), 506160)
})

test('unresolved Japanese variants remain an error instead of selecting the first ID', () => {
  assert.throws(() => selectSnkrdunkId([link(1, lillie), link(2, lillie)],
    'リーリエのピッピex', 'SAR', parseCardNo('126/100')), /一意に特定できない/)
})

test('name, rarity and exact card number are still required', () => {
  for (const text of [lillie.replace('126/100', '765/742'), lillie.replace('SAR', 'AR'), lillie.replace('リーリエ', 'マオ')]) {
    assert.equal(selectSnkrdunkId([link(1, text)], 'リーリエのピッピex', 'SAR', parseCardNo('126/100')), null)
  }
  assert.equal(selectSnkrdunkId([link(1, lillie)], 'リーリエのピッピex', 'SAR', null), null)
})

// Simulate completed empty searches and transport failures without a network dependency.
function searchBrowser(failures: number, links: ReturnType<typeof link>[]) {
  let attempts = 0, closed = false
  const page = {
    setExtraHTTPHeaders: async () => {},
    goto: async () => { attempts++; return { ok: () => true } },
    waitForFunction: async () => { if (attempts <= failures) throw new Error('search timeout') },
    evaluate: async () => links,
    waitForTimeout: async () => {},
    close: async () => { closed = true },
  }
  return { browser: { newPage: async () => page } as unknown as Browser, attempts: () => attempts, closed: () => closed }
}

test('completed zero-result searches allow absent products to keep their existing Mercari path', async () => {
  const state = searchBrowser(0, [])
  assert.equal(await findSnkrdunkId(state.browser, 'ジュカインGX', 'RR', parseCardNo('010/173')), null)
  assert.equal(state.attempts(), 1)
  assert.equal(state.closed(), true)
})

test('temporary search outage is retried and resolves the correct product', async () => {
  const state = searchBrowser(2, [link(505956, lillie)])
  assert.equal(await findSnkrdunkId(state.browser, 'リーリエのピッピex', 'SAR', parseCardNo('126/100')), 505956)
  assert.equal(state.attempts(), 3)
})

test('persistent outage does not masquerade as an absent product or switch markets', async () => {
  const state = searchBrowser(3, [])
  await assert.rejects(findSnkrdunkId(state.browser, 'ジュカインGX', 'RR', parseCardNo('010/173')), /search timeout/)
  assert.equal(state.attempts(), 3)
  assert.equal(state.closed(), true)
})
