import assert from 'node:assert/strict'
import { isBoxReleased } from '../src/lib/box-release'

const announced = { certainty: 'announced' as const, release_date: '2026-09-16' }
assert.equal(isBoxReleased(announced, Date.parse('2026-09-15T14:59:59Z')), false)
assert.equal(isBoxReleased(announced, Date.parse('2026-09-15T15:00:00Z')), true)
assert.equal(isBoxReleased({ certainty: 'released', release_date: undefined }), true)
assert.equal(isBoxReleased({ certainty: 'rumored', release_date: '2026-09-16' }), false)
console.log('BOX release-date checks passed')
