# Stillfire Studio

A one-day MVP for turning traceable Swami Vivekananda teachings into short-form reel scripts and downloadable vertical MP4s. Original teaching text and its citation come only from the local knowledge base; generated interpretation is labelled separately.

## Run locally

```powershell
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies API and video requests to Express on port 8787. The demo needs no account, database, or API key.

The optional OpenAI integration uses Chat Completions for script generation and the Speech API for narration. The real-video path uses Google Veo 3.1 through Replicate. Add your own provider keys before starting:

```powershell
$env:OPENAI_API_KEY = "your-key"
$env:OPENAI_MODEL = "gpt-4o-mini"
$env:REPLICATE_API_TOKEN = "your-replicate-token"
npm run dev
```

With `REPLICATE_API_TOKEN`, **Generate AI video + MP4** submits one six-second 9:16 Veo 3.1 hook clip, polls the Replicate job, downloads the clip, and composites it with the source-safe storyboard and narration. Replicate usage is billed by the provider; check the model's current pricing before running a generation. The final MP4 is 1080 × 1920; the generated hook source is 720p.

Without a Replicate token, the app exports the local motion-card fallback. Without an OpenAI key, the API uses a deterministic English/Kannada demo script. On Windows, local MP4 composition uses Microsoft Zira speech for English. Kannada TTS requires the optional OpenAI key; otherwise the exported MP4 is silent and the UI reports that status. FFmpeg is bundled through `ffmpeg-static`.

## YouTube publishing and analytics

Publishing uses the YouTube Data API and YouTube Analytics API with user OAuth. In Google Cloud, enable both APIs, configure the OAuth consent screen (add your Google account as a test user while the app is in testing), then create a **Web application** OAuth client. Add this exact authorized redirect URI:

```text
http://localhost:8787/api/social/youtube/callback
```

Set the OAuth client values in PowerShell before starting the server:

```powershell
$env:GOOGLE_CLIENT_ID = "your-client-id"
$env:GOOGLE_CLIENT_SECRET = "your-client-secret"
$env:GOOGLE_REDIRECT_URI = "http://localhost:8787/api/social/youtube/callback"
npm run dev
```

In **Publishing & analytics**, connect the channel, select a generated reel, review its title, and choose visibility. Uploads default to **Private**. The server attaches the exact verified teaching/source from the reel record, not browser-submitted quote text. YouTube view/like/comment counts and Analytics API shares/watch-time metrics appear per post; deeper metrics may take 24–48 hours. Google OAuth app verification and YouTube API policy/quota restrictions apply outside a local test setup.

For local OAuth testing, add your account as a test user in the Google OAuth consent screen and enable **YouTube Data API v3** and **YouTube Analytics API** for the same Cloud project. The app requests `youtube.upload`, `youtube.readonly`, and `yt-analytics.readonly`. Keep the OAuth client secret and generated `data/youtube-connection.json` file private; local credentials and post records are git-ignored.

Instagram Reels and TikTok direct publishing are not integrated yet. The publishing screen provides the MP4 download for manual upload there.

## Golden demo

1. Choose **Start with fearlessness** on the dashboard.
2. Verify the original passage and open its Complete Works Volume 3 source.
3. Generate the reel and review the six-scene storyboard.
4. Change language or format and choose **Update storyboard**.
5. Preview the portrait reel and choose **Export MP4**.

Generated videos are written to `public/reels/` and served from `/media/`; the folder is git-ignored.

## Authenticity boundary

`src/data/teachings.json` is the single knowledge base used by the app and API. All seven topics now have exact passages and links to public Wikisource transcriptions of *The Complete Works of Swami Vivekananda* (Volumes 3, 4, and 8). The local fallback creates distinct English/Kannada scripts for each topic while preserving the stored passage and source exactly.

The API loads records by ID, checks verification and source fields, validates the model-returned teaching/source exactly, validates the original-teaching scene, duration, language, and interpretation label, then repeats validation before composition.

## Checks

```powershell
npm test
npm run lint
npm run build
```