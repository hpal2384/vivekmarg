import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildVeoInput, getVeoVideoJob, startVeoVideoJob } from './videoProvider.js'

test('Veo input is vertical and does not contain the original quotation', () => {
  const input = buildVeoInput({ topic: 'Fearlessness', original_text: 'Source-owned words stay private to this model.' })
  assert.equal(input.aspect_ratio, '9:16')
  assert.equal(input.duration, 6)
  assert.equal(input.resolution, '720p')
  assert.equal(input.generate_audio, false)
  assert.match(input.prompt, /Fearlessness/)
  assert.doesNotMatch(input.prompt, /Source-owned words/)
})

test('Replicate prediction output is downloaded and composed into a reel', async () => {
  const originalFetch = globalThis.fetch
  const previousToken = process.env.REPLICATE_API_TOKEN
  process.env.REPLICATE_API_TOKEN = 'test-token'
  let submittedInput
  let composedBuffer
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).startsWith('https://api.replicate.com/')) {
      submittedInput = JSON.parse(options.body).input
      return new Response(JSON.stringify({
        id: 'test-prediction',
        status: 'succeeded',
        progress: 100,
        output: 'https://replicate.delivery/test/output.mp4',
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (String(url).startsWith('https://replicate.delivery/')) {
      return new Response(Buffer.alloc(120_000), { status: 200, headers: { 'content-type': 'video/mp4' } })
    }
    throw new Error('Unexpected test fetch')
  }

  try {
    const job = await startVeoVideoJob({
      teaching: { topic: 'Fearlessness' },
      script: { scenes: [{ visual_description: 'untrusted browser prompt' }] },
      composeVideo: async (_script, { aiVideoBuffer }) => {
        composedBuffer = aiVideoBuffer
        return { video_url: '/media/generated.mp4', duration: 42, visual_generation: 'google-veo-3.1' }
      },
    })
    for (let attempt = 0; attempt < 20 && getVeoVideoJob(job.job_id)?.status !== 'completed'; attempt += 1) {
      await new Promise((resolve) => setImmediate(resolve))
    }
    const completed = getVeoVideoJob(job.job_id)
    assert.equal(submittedInput.aspect_ratio, '9:16')
    assert.doesNotMatch(submittedInput.prompt, /untrusted browser prompt/)
    assert.equal(completed.status, 'completed')
    assert.equal(completed.video_url, '/media/generated.mp4')
    assert.equal(composedBuffer.length, 120_000)
  } finally {
    globalThis.fetch = originalFetch
    if (previousToken === undefined) delete process.env.REPLICATE_API_TOKEN
    else process.env.REPLICATE_API_TOKEN = previousToken
  }
})