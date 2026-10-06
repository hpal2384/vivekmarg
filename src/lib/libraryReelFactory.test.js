import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLibraryMomentReel } from './libraryReelFactory.js'

test('buildLibraryMomentReel creates a reel from a saved My Library moment', () => {
  const moment = {
    id: 'vm-1893',
    year: '1893',
    title: 'Chicago',
    summary: 'His journey to Chicago brings his message to the Parliament of the World’s Religions.',
    source_section: 'A Life, Year by Year · 1893',
    source_url: 'https://vivekmarg.org/'
  }

  const reel = buildLibraryMomentReel(moment)

  assert.equal(reel.title, '1893 · Chicago')
  assert.equal(reel.source, 'VivekMarg · A Life, Year by Year')
  assert.match(reel.hook, /Chicago/i)
  assert.ok(reel.scenes.some((scene) => scene.type === 'Original teaching'))
  assert.equal(reel.original_teaching, moment.summary)
})
