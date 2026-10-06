import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import ffmpegPath from 'ffmpeg-static'
import { composeVideo, reelOutputDirectory } from './composer.js'

test('local MP4 export contains decodable video and audio streams', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'stillfire-composer-test-'))
  const audioPath = path.join(tempDirectory, 'voice.wav')
  let outputPath
  try {
    execFileSync(ffmpegPath, [
      '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
      '-c:a', 'pcm_s16le', audioPath,
    ], { stdio: 'ignore' })
    const scenes = [
      ['Hook', 5, 'A new direction begins.'],
      ['Context', 5, 'Focus creates space to understand.'],
      ['Original teaching', 5, 'A verified teaching.'],
      ['AI interpretation', 5, 'AI Interpretation — Not an Original Quote: A thought for today.'],
      ['Modern takeaway', 5, 'Practice one idea.'],
      ['Closing', 5, 'Carry it forward.'],
    ].map(([type, duration, on_screen_text], index) => ({
      scene_number: index + 1,
      duration,
      type,
      narration: on_screen_text,
      on_screen_text,
      visual_description: 'A calm landscape in morning light.',
    }))
    const result = await composeVideo({
      title: 'Playable stream test',
      source: 'Verified test source',
      language: 'Kannada',
      duration: 30,
      scenes,
    }, { voiceTrackBuffer: await readFile(audioPath) })
    outputPath = path.join(reelOutputDirectory, `${result.id}.mp4`)
    execFileSync(ffmpegPath, ['-v', 'error', '-i', outputPath, '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-'], { stdio: 'ignore' })
    execFileSync(ffmpegPath, ['-v', 'error', '-i', outputPath, '-map', '0:a:0', '-frames:a', '1', '-f', 'null', '-'], { stdio: 'ignore' })
    assert.equal(result.duration, 30)
    assert.equal(result.voiceover, 'windows-speech')
  } finally {
    if (outputPath) await rm(outputPath, { force: true })
    await rm(tempDirectory, { recursive: true, force: true })
  }
})