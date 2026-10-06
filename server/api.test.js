import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { after, before, test } from 'node:test'

const port = 8879
const baseUrl = `http://127.0.0.1:${port}`
let server

before(async () => {
  const env = { ...process.env, PORT: String(port) }
  delete env.OPENAI_API_KEY
  delete env.GOOGLE_CLIENT_ID
  delete env.GOOGLE_CLIENT_SECRET
  server = spawn(process.execPath, ['server/index.js'], { env, stdio: 'ignore' })
  server.once('error', (error) => { throw error })
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('The test API did not start.')
})

after(async () => {
  if (!server || server.exitCode !== null) return
  server.kill()
  await once(server, 'exit')
})

const postJson = (path, body) => fetch(`${baseUrl}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

test('all library teachings have verified text and source references', async () => {
  const response = await fetch(`${baseUrl}/api/teachings`)
  const records = await response.json()
  assert.equal(records.length, 7)
  assert.ok(records.every((record) => record.verification_status === 'verified'))
  assert.ok(records.every((record) => record.original_text && record.source_url && record.source))
})

test('every teaching generates a topic-specific script with its exact source text', async () => {
  const records = await (await fetch(`${baseUrl}/api/teachings`)).json()
  const hooks = new Set()
  for (const teaching of records) {
    const response = await postJson('/api/generate-reel', {
      teaching_id: teaching.id, language: 'English', template: 'Storytelling',
    })
    const script = await response.json()
    assert.equal(response.status, 200, teaching.topic)
    assert.equal(script.original_teaching, teaching.original_text, teaching.topic)
    assert.equal(script.source, teaching.source, teaching.topic)
    assert.equal(script.duration, 42)
    assert.equal(script.scenes.find((scene) => scene.type === 'Original teaching').narration, teaching.original_text)
    assert.match(script.ai_interpretation, /^AI Interpretation — Not an Original Quote:/)
    assert.match(script.title, new RegExp(teaching.topic, 'i'))
    hooks.add(script.hook)
  }
  assert.equal(hooks.size, records.length)
})

test('unknown teaching IDs and unsupported languages are rejected', async () => {
  const unknown = await postJson('/api/generate-reel', {
    teaching_id: 'unknown-teaching', language: 'English', template: 'Storytelling',
  })
  assert.equal(unknown.status, 404)
  const unsupported = await postJson('/api/generate-reel', {
    teaching_id: 'fearlessness-001', language: 'Tamil', template: 'Storytelling',
  })
  assert.equal(unsupported.status, 400)
})

test('compose rejects a tampered original teaching before rendering', async () => {
  const generated = await postJson('/api/generate-reel', {
    teaching_id: 'fearlessness-001', language: 'English', template: 'Storytelling',
  })
  const script = await generated.json()
  script.original_teaching = 'A fabricated quotation.'
  const response = await postJson('/api/compose-video', { teaching_id: 'fearlessness-001', script })
  assert.equal(response.status, 422)
})

test('Kannada generation translates the story without changing the source teaching', async () => {
  const response = await postJson('/api/generate-reel', {
    teaching_id: 'self-confidence-001', language: 'Kannada', template: 'Question',
  })
  const script = await response.json()
  assert.equal(response.status, 200)
  assert.equal(script.language, 'Kannada')
  assert.match(script.hook, /ನಿಮ್ಮ/)
  assert.equal(script.original_teaching, 'My Master used to say, he who thinks himself weak will become weak, and that is true.')
  assert.match(script.ai_interpretation, /^AI Interpretation — Not an Original Quote:/)
})

test('Hindi and Punjabi are accepted as supported script languages', async () => {
  for (const language of ['Hindi', 'Punjabi']) {
    const response = await postJson('/api/generate-reel', {
      teaching_id: 'fearlessness-001', language, template: 'Storytelling',
    })
    const script = await response.json()
    assert.equal(response.status, 200, language)
    assert.equal(script.language, language)
    assert.equal(script.original_teaching, 'Be not afraid of anything. You will do marvellous work. The moment you fear, you are nobody.')
  }
})

test('malformed JSON requests receive a friendly JSON error', async () => {
  const response = await fetch(`${baseUrl}/api/generate-reel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  })
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'This request could not be processed.' })
})

test('health reports the local fallback when no video provider token is configured', async () => {
  const response = await fetch(`${baseUrl}/api/health`)
  const health = await response.json()
  assert.equal(health.video_generation, 'local-motion-cards')
})

test('social status reports YouTube OAuth setup without claiming a connection', async () => {
  const response = await fetch(`${baseUrl}/api/social/status`)
  const status = await response.json()
  assert.equal(status.youtube.configured, false)
  assert.equal(status.youtube.connected, false)
  assert.deepEqual(status.posts, [])
})

test('YouTube connect explains missing OAuth configuration', async () => {
  const response = await fetch(`${baseUrl}/api/social/youtube/connect`)
  assert.equal(response.status, 503)
  assert.match((await response.json()).error, /Google OAuth credentials/)
})

test('YouTube upload rejects client-invented source provenance', async () => {
  const response = await postJson('/api/social/youtube/upload', {
    video_id: '00000000-0000-4000-8000-000000000001',
    teaching_id: 'fearlessness-001',
    title: 'Test Short',
    privacy_status: 'private',
  })
  assert.equal(response.status, 403)
  assert.match((await response.json()).error, /saved verified teaching record/)
})

test('YouTube analytics only accepts posts created by this app', async () => {
  const response = await fetch(`${baseUrl}/api/social/youtube/analytics/not-a-post`)
  assert.equal(response.status, 404)
})