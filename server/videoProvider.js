import { randomUUID } from 'node:crypto'

const apiBase = 'https://api.replicate.com/v1'
const model = 'google/veo-3.1'
const jobs = new Map()
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export const isVeoConfigured = () => Boolean(process.env.REPLICATE_API_TOKEN)

export const buildVeoInput = (teaching) => {
  const topic = String(teaching.topic).replace(/[^\p{L}\p{N} -]/gu, '').slice(0, 60)
  return {
    prompt: `Create a cinematic vertical establishing shot for an educational reel about ${topic}. Show an anonymous student from behind at the start of a sunlit mountain trail. Use a slow, steady forward camera move, natural dawn light, realistic landscape details, and an uplifting but grounded mood. Show no identifiable public figure, no likeness of Swami Vivekananda, no readable text, no logos, no quotations, and no music.`,
    aspect_ratio: '9:16',
    duration: 6,
    resolution: '720p',
    generate_audio: false,
  }
}

const apiRequest = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(options.timeout ?? 45000),
    headers: {
      Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) throw new Error(`Video provider returned ${response.status}`)
  return response
}

const findOutputUrl = (value) => {
  if (typeof value === 'string' && value.startsWith('https://')) return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = findOutputUrl(item)
      if (url) return url
    }
  }
  if (value && typeof value === 'object') {
    if (typeof value.url === 'string') return value.url
    for (const nested of Object.values(value)) {
      const url = findOutputUrl(nested)
      if (url) return url
    }
  }
  return null
}

const publicJob = (job) => ({
  job_id: job.id,
  status: job.status,
  progress: job.progress,
  provider: 'Google Veo 3.1 via Replicate',
  message: job.message,
  ...(job.result ?? {}),
})

const finishJob = async (job, initialPrediction, script, composeVideo, reelMetadata) => {
  try {
    let prediction = initialPrediction
    for (let attempt = 0; prediction.status !== 'succeeded'; attempt += 1) {
      if (prediction.status === 'failed' || prediction.status === 'canceled' || prediction.status === 'aborted') {
        throw new Error('Video generation did not complete.')
      }
      if (attempt >= 180) throw new Error('Video generation took too long.')
      job.status = prediction.status === 'starting' ? 'starting' : 'processing'
      job.progress = Math.max(job.progress, Number(prediction.progress) || 0)
      job.message = 'Generating the 6-second Veo scene'
      await pause(4000)
      const response = await apiRequest(`${apiBase}/predictions/${encodeURIComponent(prediction.id)}`)
      prediction = await response.json()
    }

    job.status = 'processing'
    job.progress = 92
    job.message = 'Downloading the generated scene'
    const outputUrl = findOutputUrl(prediction.output)
    const output = outputUrl ? new URL(outputUrl) : null
    if (!output || output.protocol !== 'https:' || !(output.hostname === 'replicate.delivery' || output.hostname.endsWith('.replicate.delivery'))) {
      throw new Error('Video provider returned an unsupported output URL.')
    }
    const videoResponse = await fetch(output, { signal: AbortSignal.timeout(90000) })
    if (!videoResponse.ok) throw new Error('Generated video download failed.')
    const videoType = videoResponse.headers.get('content-type') || ''
    if (!videoType.includes('video') && !output.pathname.endsWith('.mp4')) throw new Error('Video provider returned an invalid video file.')
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer())
    if (videoBuffer.length < 100_000) throw new Error('Generated video file was incomplete.')

    job.message = 'Adding verified captions, source, and narration'
    job.result = await composeVideo(script, { aiVideoBuffer: videoBuffer, reelMetadata })
    job.status = 'completed'
    job.progress = 100
    job.message = 'AI-generated reel ready'
  } catch {
    job.status = 'failed'
    job.progress = 0
    job.message = 'AI video generation failed. Try the local reel export instead.'
  }
}

export const startVeoVideoJob = async ({ script, teaching, composeVideo, reelMetadata }) => {
  if (!isVeoConfigured()) throw new Error('Replicate video generation is not configured.')
  const response = await apiRequest(`${apiBase}/models/${model}/predictions`, {
    method: 'POST',
    headers: { Prefer: 'wait=1', 'Cancel-After': '15m' },
    body: JSON.stringify({ input: buildVeoInput(teaching) }),
  })
  const prediction = await response.json()
  if (!prediction.id || !prediction.status) throw new Error('Video provider returned an invalid job.')
  for (const [id, job] of jobs) {
    if (Date.now() - job.createdAt > 60 * 60 * 1000) jobs.delete(id)
  }
  const job = {
    id: randomUUID(),
    providerJobId: prediction.id,
    status: prediction.status === 'succeeded' ? 'processing' : 'starting',
    progress: Number(prediction.progress) || 0,
    message: 'Veo video generation started',
    createdAt: Date.now(),
  }
  jobs.set(job.id, job)
  void finishJob(job, prediction, script, composeVideo, reelMetadata)
  return publicJob(job)
}

export const getVeoVideoJob = (id) => {
  const job = jobs.get(id)
  return job ? publicJob(job) : null
}