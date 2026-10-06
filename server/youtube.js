import { randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { google } from 'googleapis'
import { reelOutputDirectory } from './composer.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const privateDataDirectory = path.join(root, 'data')
const connectionPath = path.join(privateDataDirectory, 'youtube-connection.json')
const postsPath = path.join(privateDataDirectory, 'youtube-posts.json')
const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8787/api/social/youtube/callback'
const scopes = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
]
const allowedPrivacy = new Set(['private', 'unlisted', 'public'])
const oauthStates = new Map()
let authClient
let saveQueue = Promise.resolve()

export const isYouTubeConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

const readJson = async (filePath, fallback) => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
}

const writeJsonAtomically = async (filePath, value) => {
  await mkdir(privateDataDirectory, { recursive: true })
  const tempPath = `${filePath}.${randomBytes(6).toString('hex')}.tmp`
  await writeFile(tempPath, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 })
  await rename(tempPath, filePath)
}

const saveConnection = async (update) => {
  saveQueue = saveQueue.then(async () => {
    const current = await readJson(connectionPath, {})
    await writeJsonAtomically(connectionPath, { ...current, ...update })
  })
  return saveQueue
}

const getAuthClient = async () => {
  if (!isYouTubeConfigured()) throw new Error('YouTube publishing is not configured.')
  if (!authClient) {
    authClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri,
    )
    authClient.on('tokens', (tokens) => {
      void readJson(connectionPath, {}).then((saved) => saveConnection({ credentials: { ...saved.credentials, ...tokens } }))
    })
    const saved = await readJson(connectionPath, {})
    if (saved.credentials) authClient.setCredentials(saved.credentials)
  }
  return authClient
}

const getAuthorizedServices = async () => {
  const auth = await getAuthClient()
  const saved = await readJson(connectionPath, {})
  if (!saved.credentials?.refresh_token && !saved.credentials?.access_token) {
    throw new Error('Connect a YouTube channel before using this feature.')
  }
  auth.setCredentials(saved.credentials)
  return {
    youtube: google.youtube({ version: 'v3', auth }),
    analytics: google.youtubeAnalytics({ version: 'v2', auth }),
    saved,
  }
}

export const getYouTubeStatus = async () => {
  const saved = await readJson(connectionPath, {})
  return {
    configured: isYouTubeConfigured(),
    connected: Boolean(saved.credentials?.refresh_token || saved.credentials?.access_token),
    channel: saved.channel ?? null,
  }
}

export const createYouTubeAuthorizationUrl = async () => {
  const auth = await getAuthClient()
  const state = randomBytes(24).toString('hex')
  const now = Date.now()
  for (const [key, createdAt] of oauthStates) {
    if (now - createdAt > 10 * 60 * 1000) oauthStates.delete(key)
  }
  oauthStates.set(state, now)
  return auth.generateAuthUrl({
    access_type: 'offline',
    include_granted_scopes: false,
    prompt: 'consent',
    scope: scopes,
    state,
  })
}

export const completeYouTubeAuthorization = async ({ code, state }) => {
  const createdAt = oauthStates.get(state)
  oauthStates.delete(state)
  if (!createdAt || Date.now() - createdAt > 10 * 60 * 1000) {
    throw Object.assign(new Error('OAuth state validation failed.'), { status: 400 })
  }
  const auth = await getAuthClient()
  const { tokens } = await auth.getToken(code)
  auth.setCredentials(tokens)
  const youtube = google.youtube({ version: 'v3', auth })
  const channelResponse = await youtube.channels.list({ part: ['snippet'], mine: true, maxResults: 1 })
  const channel = channelResponse.data.items?.[0]
  if (!channel?.id) throw new Error('No YouTube channel was returned for this account.')
  await saveConnection({
    credentials: { ...(await readJson(connectionPath, {})).credentials, ...tokens },
    channel: { id: channel.id, title: channel.snippet?.title ?? 'YouTube channel' },
    connectedAt: new Date().toISOString(),
  })
  return { id: channel.id, title: channel.snippet?.title ?? 'YouTube channel' }
}

export const disconnectYouTube = async () => {
  const saved = await readJson(connectionPath, {})
  const token = saved.credentials?.refresh_token || saved.credentials?.access_token
  if (token && authClient) {
    try {
      await authClient.revokeToken(token)
    } catch {}
  }
  authClient = undefined
  await rm(connectionPath, { force: true })
}

export const buildYouTubeDescription = (teaching) => [
  `Topic: ${teaching.topic}`,
  '',
  'Original teaching (verbatim):',
  `"${teaching.original_text}"`,
  '',
  `Source: ${teaching.source}`,
  teaching.source_url,
  '',
  'This reel includes an AI-generated modern interpretation. It is not an original quote.',
  '',
  '#Shorts #Vivekananda',
].join('\n')

const readPosts = () => readJson(postsPath, [])

export const listYouTubePosts = () => readPosts()

export const uploadYouTubeShort = async ({ videoId, teaching, title, privacyStatus = 'private' }) => {
  if (!allowedPrivacy.has(privacyStatus)) throw Object.assign(new Error('Unsupported visibility setting.'), { status: 400 })
  if (!/^[0-9a-f-]{36}$/i.test(videoId)) throw Object.assign(new Error('Invalid local reel ID.'), { status: 400 })
  const videoPath = path.resolve(reelOutputDirectory, `${videoId}.mp4`)
  if (!videoPath.startsWith(`${path.resolve(reelOutputDirectory)}${path.sep}`)) {
    throw Object.assign(new Error('Invalid local reel path.'), { status: 400 })
  }
  try {
    const { size } = await stat(videoPath)
    if (!size) throw new Error('Empty reel file.')
  } catch {
    throw Object.assign(new Error('The generated MP4 is not available on this server.'), { status: 404 })
  }

  const { youtube, saved } = await getAuthorizedServices()
  const cleanTitle = String(title || `${teaching.topic} | Stillfire Studio`).trim().slice(0, 100)
  if (!cleanTitle) throw Object.assign(new Error('Enter a title for this Short.'), { status: 400 })
  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: cleanTitle,
        description: buildYouTubeDescription(teaching),
        categoryId: '27',
        tags: ['Swami Vivekananda', teaching.topic, 'education', 'Shorts'],
      },
      status: { privacyStatus, selfDeclaredMadeForKids: false },
    },
    media: { body: createReadStream(videoPath) },
  })
  const uploaded = response.data
  if (!uploaded.id) throw new Error('YouTube did not return an uploaded video ID.')
  const post = {
    platform: 'youtube',
    video_id: uploaded.id,
    title: uploaded.snippet?.title ?? cleanTitle,
    teaching_id: teaching.id,
    topic: teaching.topic,
    source: teaching.source,
    privacy_status: uploaded.status?.privacyStatus ?? privacyStatus,
    published_at: uploaded.snippet?.publishedAt ?? new Date().toISOString(),
    watch_url: `https://www.youtube.com/shorts/${uploaded.id}`,
  }
  const posts = await readPosts()
  posts.unshift(post)
  await writeJsonAtomically(postsPath, posts.slice(0, 100))
  return { ...post, channel: saved.channel }
}

export const getYouTubeAnalytics = async (videoId) => {
  const posts = await readPosts()
  const post = posts.find((item) => item.video_id === videoId)
  if (!post) throw Object.assign(new Error('Analytics are only available for videos published by this app.'), { status: 404 })
  const { youtube, analytics } = await getAuthorizedServices()
  const videoResponse = await youtube.videos.list({ part: ['statistics'], id: [videoId] })
  const stats = videoResponse.data.items?.[0]?.statistics ?? {}
  const startDate = post.published_at.slice(0, 10)
  const endDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  let values = []
  let note = null
  if (startDate <= endDate) {
    try {
      const analyticsResponse = await analytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'estimatedMinutesWatched,averageViewDuration,shares',
      filters: `video==${videoId}`,
      })
      values = analyticsResponse.data.rows?.[0] ?? []
    } catch {
      note = 'Basic counts are current; detailed watch metrics are still processing.'
    }
  } else {
    note = 'Basic counts are current; detailed analytics can take 24–48 hours to appear.'
  }
  return {
    video_id: videoId,
    views: Number(stats.viewCount ?? 0),
    likes: Number(stats.likeCount ?? 0),
    comments: Number(stats.commentCount ?? 0),
    watch_minutes: Number(values[0] ?? 0),
    average_view_seconds: Number(values[1] ?? 0),
    shares: Number(values[2] ?? 0),
    refreshed_at: new Date().toISOString(),
    note: values.length ? null : note ?? 'YouTube analytics can take 24–48 hours to appear.',
  }
}