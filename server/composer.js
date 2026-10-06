import { randomUUID } from 'node:crypto'
import { execFile as execFileCallback } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'
import { saveReelRecord } from './reelStore.js'

const execFile = promisify(execFileCallback)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = path.join(root, 'public/reels')
const escapeXml = (text) => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')

const wrapText = (text, maxChars) => {
  const words = String(text).split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (candidate.length > maxChars && line) {
      lines.push(line)
      line = word
    } else line = candidate
  }
  if (line) lines.push(line)
  return lines
}

const textBlock = (text, x, y, maxChars, lineHeight, size, fill, weight = 500) => {
  const lines = wrapText(text, maxChars).slice(0, 8)
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}">${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join('')}</text>`
}

const sceneSvg = (scene, script, index) => {
  const original = scene.type === 'Original teaching'
  const interpretation = scene.type === 'AI interpretation'
  const label = original ? 'ORIGINAL TEACHING' : interpretation ? 'AI INTERPRETATION · NOT AN ORIGINAL QUOTE' : scene.type.toUpperCase()
  const title = original ? scene.narration : scene.on_screen_text
  const titleLines = wrapText(title, original ? 30 : 26).slice(0, 8)
  const titleSize = original ? 47 : 59
  const lineHeight = original ? 66 : 78
  const titleY = original ? 700 : 845
  const titleBlock = textBlock(title, 90, titleY, original ? 30 : 26, lineHeight, titleSize, '#fffaf0', 600)
  const sourceBlock = original
    ? `<text x="90" y="1450" fill="#dae1d4" font-family="Arial, sans-serif" font-size="23">${escapeXml(script.source)}</text>`
    : ''
  const caption = interpretation ? 'AI Interpretation — Not an Original Quote' : scene.on_screen_text
  const captionY = Math.min(1550, Math.max(1250, titleY + titleLines.length * lineHeight + 75))
  const palette = ['#b7c6ac', '#c2b18d', '#d58f68', '#799482', '#a9b08e', '#9f9b84']
  const sceneAccent = palette[index % palette.length]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${sceneAccent}"/><stop offset=".54" stop-color="#e6bd8c"/><stop offset="1" stop-color="#354d3f"/></linearGradient><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#183329" stop-opacity=".12"/><stop offset=".55" stop-color="#183329" stop-opacity=".02"/><stop offset="1" stop-color="#142d22" stop-opacity=".92"/></linearGradient></defs>
    <rect width="1080" height="1920" fill="url(#sky)"/><circle cx="810" cy="390" r="112" fill="#ffe2ad" opacity=".92"/><circle cx="810" cy="390" r="184" fill="#ffe2ad" opacity=".16"/>
    <path d="M0 1070 180 790 340 935 555 595 720 900 870 690 1080 970v950H0Z" fill="#667f69" opacity=".88"/><path d="m0 1175 195-250 143 170 204-260 220 270 130-155 188 235v735H0Z" fill="#314e3d"/><path d="M418 1920c75-320 180-442 312-675 42-74 92-136 151-199-33 167-70 291-120 417-83 209-117 331-91 457Z" fill="#d88d62" opacity=".88"/>
    <rect width="1080" height="1920" fill="url(#shade)"/><text x="88" y="113" fill="#fff9ed" font-family="Arial, sans-serif" font-size="24" letter-spacing="4">STILLFIRE ORIGINAL</text><text x="88" y="525" fill="#ffcb9f" font-family="Arial, sans-serif" font-size="21" letter-spacing="4">${escapeXml(label)}</text>
    ${titleBlock}${sourceBlock}<rect x="74" y="${captionY}" width="932" height="145" rx="8" fill="#172b21" fill-opacity=".84"/>${textBlock(caption, 105, captionY + 55, 53, 34, 28, '#fffdf7', 600)}
    <text x="88" y="1813" fill="#e5e9dc" font-family="Arial, sans-serif" font-size="22">TEACHING TO REEL · ${String(index + 1).padStart(2, '0')}</text><text x="992" y="1813" text-anchor="end" fill="#e5e9dc" font-family="Arial, sans-serif" font-size="22">${script.duration}s</text>
  </svg>`
}

const hookCaptionSvg = (scene) => `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><rect x="72" y="1450" width="936" height="208" rx="12" fill="#172b21" fill-opacity=".82"/>${textBlock(scene.on_screen_text, 110, 1510, 42, 40, 34, '#fffdf7', 600)}</svg>`

const makeVoiceTrack = async (directory, script) => {
  const narration = script.scenes.map((scene) => scene.narration).join('. ')
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          model: 'gpt-4o-mini-tts',
          voice: 'coral',
          input: narration,
          instructions: `Speak clearly and naturally for a youth-oriented educational reel. Use ${script.language}.`,
          response_format: 'mp3',
        }),
      })
      if (response.ok) {
        const audioPath = path.join(directory, 'voice.mp3')
        await writeFile(audioPath, Buffer.from(await response.arrayBuffer()))
        return audioPath
      }
    } catch {}
  }
  if (script.language !== 'English' || process.platform !== 'win32') return null
  const textPath = path.join(directory, 'voice.txt')
  const outputPath = path.join(directory, 'voice.wav')
  const psPath = path.join(directory, 'speak.ps1')
  await writeFile(textPath, narration, 'utf8')
  await writeFile(psPath, [
    'Add-Type -AssemblyName System.Speech',
    '$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$speaker.SelectVoice("Microsoft Zira Desktop")',
    '$speaker.Rate = 0',
    `$text = Get-Content -Raw -LiteralPath '${textPath.replaceAll("'", "''")}'`,
    `$speaker.SetOutputToWaveFile('${outputPath.replaceAll("'", "''")}')`,
    '$speaker.Speak($text)',
    '$speaker.Dispose()',
  ].join('\n'), 'utf8')
  await execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', psPath], { timeout: 45000, windowsHide: true })
  await readFile(outputPath)
  return outputPath
}

export const composeVideo = async (script, { aiVideoBuffer, voiceTrackBuffer, reelMetadata } = {}) => {
  if (!ffmpegPath) throw new Error('The local video composer is unavailable.')
  const duration = script.scenes.reduce((sum, scene) => sum + scene.duration, 0)
  if (duration < 30 || duration > 60) throw new Error('The reel duration is invalid.')
  const reelId = randomUUID()
  const workDirectory = await mkdtemp(path.join(os.tmpdir(), 'stillfire-'))
  try {
    const sceneFrames = []
    for (const [index, scene] of script.scenes.entries()) {
      if (aiVideoBuffer && index === 0) continue
      const imagePath = path.join(workDirectory, `scene-${index}.png`)
      await sharp(Buffer.from(sceneSvg(scene, script, index))).png().toFile(imagePath)
      sceneFrames.push({ imagePath, duration: scene.duration })
    }
    const manifestPath = path.join(workDirectory, 'scenes.txt')
    const manifest = sceneFrames.flatMap(({ imagePath, duration }) => [`file '${imagePath.replaceAll('\\', '/')}'`, `duration ${duration}`]).concat([`file '${sceneFrames.at(-1).imagePath.replaceAll('\\', '/')}'`]).join('\n')
    await writeFile(manifestPath, manifest, 'utf8')
    let aiVideoPath
    let hookCaptionPath
    if (aiVideoBuffer) {
      aiVideoPath = path.join(workDirectory, 'veo-hook.mp4')
      await writeFile(aiVideoPath, aiVideoBuffer)
      hookCaptionPath = path.join(workDirectory, 'hook-caption.png')
      await sharp(Buffer.from(hookCaptionSvg(script.scenes[0]))).png().toFile(hookCaptionPath)
    }
    let voicePath = null
    if (voiceTrackBuffer) {
      voicePath = path.join(workDirectory, 'voice.wav')
      await writeFile(voicePath, voiceTrackBuffer)
    } else {
      voicePath = await makeVoiceTrack(workDirectory, script).catch(() => null)
    }
    await mkdir(outputDirectory, { recursive: true })
    const outputPath = path.join(outputDirectory, `${reelId}.mp4`)
    const args = ['-y']
    if (aiVideoPath) {
      args.push('-i', aiVideoPath, '-loop', '1', '-framerate', '25', '-t', String(script.scenes[0].duration), '-i', hookCaptionPath)
    }
    args.push('-f', 'concat', '-safe', '0', '-i', manifestPath)
    if (voicePath) args.push('-i', voicePath)
    if (aiVideoPath) {
      const hookDuration = script.scenes[0].duration
      args.push(
        '-filter_complex',
        `[0:v]trim=duration=${hookDuration},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=25,setsar=1,format=yuv420p[hook];[1:v]fps=25,format=rgba[caption];[hook][caption]overlay=0:0:shortest=1,format=yuv420p[hookcaption];[2:v]fps=25,scale=1080:1920,setsar=1,format=yuv420p[slides];[hookcaption][slides]concat=n=2:v=1:a=0[v]`,
        '-map', '[v]',
      )
      if (voicePath) args.push('-map', '3:a:0')
    } else {
      args.push('-vf', 'fps=25,scale=1080:1920,format=yuv420p')
      if (voicePath) args.push('-map', '0:v:0', '-map', '1:a:0')
    }
    args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-t', String(duration))
    if (voicePath) args.push('-af', 'apad', '-c:a', 'aac', '-b:a', '128k')
    args.push('-movflags', '+faststart', outputPath)
    await execFile(ffmpegPath, args, { timeout: 120000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 })
    const stat = await readFile(outputPath)
    if (stat.length < 100_000) throw new Error('The composed reel file is incomplete.')
    const result = { id: reelId, video_url: `/media/${reelId}.mp4`, duration, voiceover: voicePath?.endsWith('.mp3') ? 'openai-tts' : voicePath ? 'windows-speech' : 'unavailable', visual_generation: aiVideoPath ? 'google-veo-3.1' : 'local-motion-cards' }
    if (reelMetadata) await saveReelRecord({ ...result, ...reelMetadata, created_at: new Date().toISOString() })
    return result
  } finally {
    await rm(workDirectory, { recursive: true, force: true })
  }
}

export const reelOutputDirectory = outputDirectory