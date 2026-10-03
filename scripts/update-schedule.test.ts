import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { getNextMarketUpdateMs, MARKET_UPDATE_HOURS_JST, POKEMON_UPDATE_MINUTE_JST, ONEPIECE_UPDATE_MINUTE_JST } from '../src/lib/update-schedule'
const require = createRequire(import.meta.url)
const yaml = require('js-yaml')
type Workflow = { on: { schedule: { cron: string }[] }; jobs: Record<string, { concurrency?: { group: string } }>; concurrency?: { group: string } }
const workflow = (name: string): Workflow => yaml.load(fs.readFileSync(`.github/workflows/${name}.yml`, 'utf8'))

test('countdown advances through morning, night, and JST date rollover', () => {
  for (const minute of [POKEMON_UPDATE_MINUTE_JST, ONEPIECE_UPDATE_MINUTE_JST]) {
    const before = Date.parse(`2026-10-03T10:${minute - 1}:59+09:00`)
    assert.equal(getNextMarketUpdateMs(before, minute), before + 1000)
    const morning = Date.parse(`2026-10-03T10:${minute}:00+09:00`)
    assert.equal(getNextMarketUpdateMs(morning, minute), Date.parse(`2026-10-03T23:${minute}:00+09:00`))
    const night = Date.parse(`2026-10-03T23:${minute}:00+09:00`)
    assert.equal(getNextMarketUpdateMs(night, minute), Date.parse(`2026-10-04T10:${minute}:00+09:00`))
  }
})

test('workflows and displayed start times agree, including full/prices mode selection', () => {
  const pokemon = workflow('update-forecasts')
  const expected = MARKET_UPDATE_HOURS_JST.map(hour => `${POKEMON_UPDATE_MINUTE_JST} ${hour - 9} * * *`)
  assert.deepEqual(pokemon.on.schedule.map(s => s.cron), expected)
  const text = fs.readFileSync('.github/workflows/update-forecasts.yml', 'utf8')
  assert.ok(text.includes(`"${expected[0]}")  echo "mode=full"`))
  assert.ok(text.includes(`"${expected[1]}") echo "mode=prices"`))
  assert.deepEqual(workflow('update-onepiece-prices').on.schedule.map(s => s.cron), [`${ONEPIECE_UPDATE_MINUTE_JST} ${MARKET_UPDATE_HOURS_JST.map(hour => hour - 9).join(',')} * * *`])
})

test('long forecasts and ONE PIECE cannot block Pokemon prices; competing listing writers stay serialized', () => {
  const pokemon = workflow('update-forecasts')
  const group = pokemon.jobs.update.concurrency?.group
  assert.ok(group)
  assert.notEqual(pokemon.jobs.forecasts.concurrency?.group, group)
  assert.notEqual(workflow('update-onepiece-prices').jobs.update.concurrency?.group, group)
  assert.equal(workflow('update-onepiece-prices').jobs.forecasts.concurrency?.group, pokemon.jobs.forecasts.concurrency?.group)
  assert.equal(workflow('update-bargain-listings').concurrency?.group, group)
  assert.notEqual(workflow('update-bargain-listings').on.schedule[0].cron.split(' ')[0], String(POKEMON_UPDATE_MINUTE_JST))
})
