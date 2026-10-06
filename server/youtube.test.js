import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildYouTubeDescription } from './youtube.js'

test('YouTube upload description uses the exact verified teaching and citation', () => {
  const teaching = {
    topic: 'Education',
    original_text: 'Education is the manifestation of the perfection already in man.',
    source: 'The Complete Works of Swami Vivekananda, Vol. 4, “What We Believe In”',
    source_url: 'https://example.test/verified-source',
  }
  const description = buildYouTubeDescription(teaching)
  assert.ok(description.includes(`"${teaching.original_text}"`))
  assert.ok(description.includes(teaching.source))
  assert.ok(description.includes(teaching.source_url))
  assert.match(description, /AI-generated modern interpretation/i)
  assert.match(description, /#Shorts/)
})