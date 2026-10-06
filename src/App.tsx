import { useEffect, useState } from 'react'
import { Activity, ArrowLeft, ArrowRight, BadgeCheck, BarChart3, BookOpenText, Camera, Check, ChevronDown, CircleHelp, Clapperboard, Clock3, Download, ExternalLink, Eye, Film, Heart, LayoutDashboard, Library, LoaderCircle, LockKeyhole, MessageCircle, Music2, Play, Plus, RefreshCw, Search, Share2, ShieldCheck, Sparkles, Upload, Video, Volume2 } from 'lucide-react'
import teachingRecords from './data/teachings.json'
import vivekmargLifeRecords from './data/vivekmarg-life.json'
import { buildLibraryMomentReel } from './lib/libraryReelFactory.js'
import './studio.css'

type Screen = 'home' | 'library' | 'source' | 'pipeline' | 'storyboard' | 'reel' | 'distribution'
type Template = 'Storytelling' | 'Quote focused' | 'Question'
type Teaching = (typeof teachingRecords)[number]
const teachings = teachingRecords as Teaching[]
type VivekMargLifeMoment = (typeof vivekmargLifeRecords)[number]
const vivekmargLifeMoments = vivekmargLifeRecords as VivekMargLifeMoment[]
type Scene = { scene_number: number; duration: number; type: string; narration: string; on_screen_text: string; visual_description: string }
type ReelScript = { title: string; hook: string; original_teaching: string; source: string; ai_interpretation: string; takeaway: string; language: string; duration: number; scenes: Scene[] }
type ReelFile = { id: string; video_url: string; created_at: string; bytes: number; title?: string; topic?: string; teaching_id?: string; source?: string; source_url?: string }
type SocialPost = { video_id: string; title: string; topic: string; privacy_status: string; published_at: string; watch_url: string }
type SocialAnalytics = { video_id: string; views: number; likes: number; comments: number; shares: number; watch_minutes: number; average_view_seconds: number; note: string | null }

const verifiedTeaching = teachings[0]
const verifiedTeachingCount = teachings.filter((teaching) => teaching.verification_status === 'verified').length
const todayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()).toUpperCase()
const demoReel: ReelScript = {
  title: 'Make fear move aside',
  hook: 'What would you try if fear wasn’t in charge?',
  original_teaching: verifiedTeaching.original_text!,
  source: verifiedTeaching.source,
  ai_interpretation: 'This teaching invites us to notice when fear is making our choices for us, then take one clear step anyway.',
  takeaway: 'Courage can begin with one small action.',
  language: 'English',
  duration: 42,
  scenes: [
    { scene_number: 1, duration: 6, type: 'Hook', narration: 'What would you try if fear wasn’t in charge?', on_screen_text: 'WHAT IF FEAR WASN’T IN CHARGE?', visual_description: 'A lone figure looking toward a sunlit mountain trail.' },
    { scene_number: 2, duration: 7, type: 'Context', narration: 'The first step can feel bigger than the thing you are trying to do. That hesitation is human, but it does not have to make the decision.', on_screen_text: 'The pause before the first step.', visual_description: 'A quiet trail through open hills, morning light.' },
    { scene_number: 3, duration: 8, type: 'Original teaching', narration: verifiedTeaching.original_text!, on_screen_text: verifiedTeaching.original_text!, visual_description: 'A warm source card with its citation.' },
    { scene_number: 4, duration: 8, type: 'AI interpretation', narration: 'This teaching invites us to notice when fear is making our choices for us, then take one clear step anyway.', on_screen_text: 'AI INTERPRETATION · NOT AN ORIGINAL QUOTE', visual_description: 'A figure begins walking toward a bright horizon.' },
    { scene_number: 5, duration: 7, type: 'Modern takeaway', narration: 'Courage can begin with one small action.', on_screen_text: 'ONE SMALL ACTION IS A START.', visual_description: 'Shoes take a step onto a sunlit path.' },
    { scene_number: 6, duration: 6, type: 'Closing', narration: 'Take the step. Let the rest follow.', on_screen_text: 'TAKE THE STEP.', visual_description: 'A wide open sky over a mountain path.' },
  ],
}
const pipelineSteps = ['Teaching verified', 'Story shaped', 'Storyboard drafted', 'Visuals prepared', 'Voiceover & captions', 'Reel composed']

function App() {
  const [screen, setScreen] = useState<Screen>(() => new URLSearchParams(window.location.search).get('view') === 'distribution' ? 'distribution' : 'home')
  const [selectedTeaching, setSelectedTeaching] = useState<Teaching>(verifiedTeaching)
  const [script, setScript] = useState<ReelScript>(demoReel)
  const [pipelineStep, setPipelineStep] = useState(0)
  const [template, setTemplate] = useState<Template>('Storytelling')
  const [language, setLanguage] = useState('English')
  const [searchText, setSearchText] = useState('')
  const [libraryTab, setLibraryTab] = useState<'teachings' | 'vivekmarg' | 'my-library'>('teachings')
  const [savedLifeMomentIds, setSavedLifeMomentIds] = useState<string[]>([])
  const [libraryReady, setLibraryReady] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [voiceoverType, setVoiceoverType] = useState('')
  const [videoMode, setVideoMode] = useState('local-motion-cards')
  const [videoProgress, setVideoProgress] = useState({ progress: 0, message: '' })
  const [isComposing, setIsComposing] = useState(false)
  const [isUpdatingScript, setIsUpdatingScript] = useState(false)
  const [error, setError] = useState('')
  const [youtubeStatus, setYoutubeStatus] = useState<{ configured: boolean; connected: boolean; channel: { id: string; title: string } | null }>({ configured: false, connected: false, channel: null })
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([])
  const [localReels, setLocalReels] = useState<ReelFile[]>([])
  const [selectedUploadReelId, setSelectedUploadReelId] = useState('')
  const [publishTitle, setPublishTitle] = useState('')
  const [publishPrivacy, setPublishPrivacy] = useState('private')
  const [publishing, setPublishing] = useState(false)
  const [socialMessage, setSocialMessage] = useState(() => new URLSearchParams(window.location.search).get('social') === 'youtube-connected' ? 'YouTube channel connected.' : '')
  const [socialError, setSocialError] = useState(() => new URLSearchParams(window.location.search).get('social') === 'youtube-connect-error' ? 'YouTube connection failed. Check the OAuth setup and try again.' : '')
  const [socialAnalytics, setSocialAnalytics] = useState<SocialAnalytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  useEffect(() => {
    let isActive = true
    fetch('/api/library')
      .then(async (response) => {
        if (!response.ok) throw new Error('Library unavailable')
        const data = await response.json() as string[]
        if (isActive) {
          setSavedLifeMomentIds(data)
          setLibraryReady(true)
        }
      })
      .catch(() => {
        if (isActive) {
          setSavedLifeMomentIds([])
          setLibraryReady(true)
        }
      })
    return () => { isActive = false }
  }, [])

  useEffect(() => {
    if (!libraryReady) return
    fetch('/api/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moment_ids: savedLifeMomentIds }),
    }).catch(() => undefined)
  }, [libraryReady, savedLifeMomentIds])

  useEffect(() => {
    let isActive = true
    fetch('/api/health')
      .then((response) => response.json())
      .then((health: { video_generation?: string }) => {
        if (isActive && health.video_generation) setVideoMode(health.video_generation)
      })
      .catch(() => undefined)
    return () => { isActive = false }
  }, [])

  useEffect(() => {
    if (screen !== 'distribution') return
    let active = true
    Promise.all([
      fetch('/api/social/status').then(async (response) => {
        if (!response.ok) throw new Error('Publishing status unavailable')
        return response.json()
      }),
      fetch('/api/reels').then(async (response) => {
        if (!response.ok) throw new Error('Reel list unavailable')
        return response.json()
      }),
    ]).then(([social, reels]: [{ youtube: typeof youtubeStatus; posts: SocialPost[] }, ReelFile[]]) => {
      if (!active) return
      setYoutubeStatus(social.youtube)
      setSocialPosts(social.posts)
      setLocalReels(reels)
      const currentId = videoUrl.split('/').pop()
      const preferred = reels.find((reel) => reel.id === currentId && reel.teaching_id) ?? reels.find((reel) => reel.teaching_id)
      if (preferred) {
        setSelectedUploadReelId((selected) => selected || preferred.id)
        setPublishTitle((current) => current || preferred.title || '')
      }
    }).catch(() => {
      if (active) setSocialError('Publishing services are temporarily unavailable.')
    })
    return () => { active = false }
  }, [screen, videoUrl])

  useEffect(() => {
    if (screen !== 'pipeline') return
    if (pipelineStep >= pipelineSteps.length) {
      const timer = window.setTimeout(() => setScreen('storyboard'), 400)
      return () => window.clearTimeout(timer)
    }
    const timer = window.setTimeout(() => setPipelineStep((step) => step + 1), 760)
    return () => window.clearTimeout(timer)
  }, [pipelineStep, screen])

  const startTeaching = (teaching: Teaching) => {
    if (teaching.verification_status !== 'verified' || !teaching.source_url || !teaching.original_text) return
    setSelectedTeaching(teaching)
    setScript({ ...demoReel, original_teaching: teaching.original_text, source: teaching.source })
    setVideoUrl('')
    setVideoProgress({ progress: 0, message: '' })
    setError('')
    setScreen('source')
  }

  const startLibraryMomentReel = (moment: VivekMargLifeMoment) => {
    const libraryTeaching = {
      id: `library-${moment.id}`,
      topic: moment.title,
      category: 'Life history',
      original_text: moment.summary,
      source: 'VivekMarg · A Life, Year by Year',
      source_url: moment.source_url,
      source_type: 'Life history summary',
      verification_status: 'verified',
    } as Teaching

    setSelectedTeaching(libraryTeaching)
    setScript(buildLibraryMomentReel(moment))
    setVideoUrl('')
    setVideoProgress({ progress: 0, message: '' })
    setError('')
    setScreen('storyboard')
  }

  const generateReel = async () => {
    setError('')
    setPipelineStep(0)
    setScreen('pipeline')
    try {
      const response = await fetch('/api/generate-reel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teaching_id: selectedTeaching.id, language, template }) })
      if (response.ok) setScript(await response.json() as ReelScript)
      else if (response.status !== 404) throw new Error('Generation unavailable')
    } catch { setError('Using the prepared demo story. Live generation is temporarily unavailable.') }
  }

  const speakNarration = () => {
    if (!('speechSynthesis' in window)) { setError('Voice playback is not available in this browser.'); return }
    if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); return }
    const utterance = new SpeechSynthesisUtterance(script.scenes.map((scene) => scene.narration).join(' '))
    utterance.lang = language === 'Kannada' ? 'kn-IN' : 'en-IN'
    utterance.rate = 0.92
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  const composeVideo = async () => {
    setIsComposing(true)
    setError('')
    setVideoProgress({ progress: 0, message: 'Preparing verified reel content' })
    try {
      const response = await fetch('/api/compose-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teaching_id: selectedTeaching.id, script }),
      })
      if (!response.ok) throw new Error('Video composition failed')
      let result = await response.json() as { job_id?: string; status?: string; progress?: number; message?: string; video_url?: string; voiceover?: string }
      if (response.status === 202 && result.job_id) {
        const jobId = result.job_id
        for (let attempt = 0; attempt < 180; attempt += 1) {
          setVideoProgress({ progress: result.progress ?? 0, message: result.message ?? 'Generating AI video' })
          if (result.status === 'completed') break
          if (result.status === 'failed') throw new Error('AI video generation failed')
          await new Promise((resolve) => window.setTimeout(resolve, 4000))
          const jobResponse = await fetch(`/api/video-jobs/${encodeURIComponent(jobId)}`)
          if (!jobResponse.ok) throw new Error('Video status unavailable')
          result = await jobResponse.json()
        }
      }
      if (!result.video_url) throw new Error('Video composition did not finish')
      setVideoUrl(result.video_url)
      setVoiceoverType(result.voiceover ?? 'unavailable')
      setVideoProgress({ progress: 100, message: 'Reel ready' })
    } catch {
      setError('Your reel could not be exported just now. Please try again.')
    } finally {
      setIsComposing(false)
    }
  }

  const regenerateScript = async () => {
    setIsUpdatingScript(true)
    setError('')
    try {
      const response = await fetch('/api/generate-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teaching_id: selectedTeaching.id, language, template }),
      })
      if (!response.ok) throw new Error('Generation unavailable')
      setScript(await response.json() as ReelScript)
    } catch {
      setError('The storyboard could not be updated. Please try again.')
    } finally {
      setIsUpdatingScript(false)
    }
  }

  const toggleLifeMoment = (id: string) => {
    setSavedLifeMomentIds((saved) => saved.includes(id) ? saved.filter((savedId) => savedId !== id) : [...saved, id])
  }

  const publishToYouTube = async () => {
    setPublishing(true)
    setSocialError('')
    setSocialMessage('')
    try {
      const response = await fetch('/api/social/youtube/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: selectedUploadReelId, title: publishTitle, privacy_status: publishPrivacy }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'YouTube upload failed.')
      setSocialPosts((posts) => [result, ...posts.filter((post) => post.video_id !== result.video_id)])
      setSocialMessage('Your Short was uploaded to YouTube.')
    } catch (publishError) {
      setSocialError(publishError instanceof Error ? publishError.message : 'YouTube upload failed.')
    } finally {
      setPublishing(false)
    }
  }

  const disconnectYouTube = async () => {
    setSocialError('')
    try {
      const response = await fetch('/api/social/youtube/connection', { method: 'DELETE' })
      if (!response.ok) throw new Error('Could not disconnect YouTube.')
      setYoutubeStatus({ configured: true, connected: false, channel: null })
      setSocialMessage('YouTube disconnected from this workspace.')
    } catch {
      setSocialError('Could not disconnect YouTube right now.')
    }
  }

  const refreshAnalytics = async (videoId: string) => {
    setAnalyticsLoading(true)
    setSocialError('')
    try {
      const response = await fetch(`/api/social/youtube/analytics/${encodeURIComponent(videoId)}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Analytics unavailable.')
      setSocialAnalytics(result as SocialAnalytics)
    } catch (analyticsError) {
      setSocialError(analyticsError instanceof Error ? analyticsError.message : 'Analytics unavailable.')
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const teachingCard = (teaching: Teaching) => {
    const verified = teaching.verification_status === 'verified'
    const volume = teaching.source.match(/Vol(?:ume)?\.?\s*(\d+)/i)?.[1]
    return <article className="teaching-card" key={teaching.id}>
      <div className="card-topline"><span className="topic-tag">{teaching.category}</span><span className={verified ? 'verify-tag' : 'pending-tag'}>{verified ? <><BadgeCheck size={13} /> Source linked</> : <><LockKeyhole size={12} /> Needs review</>}</span></div>
      <h3>{teaching.topic}</h3><p className="teaching-excerpt">{teaching.original_text ? `“${teaching.original_text}”` : 'Verified passage and primary-source reference have not been added yet.'}</p>
      <div className="teaching-card-footer"><span>{verified ? `Complete Works · Vol. ${volume}` : 'Needs source review'}</span><button disabled={!verified} onClick={() => startTeaching(teaching)}>{verified ? 'Verify source' : 'Unavailable'} <ArrowRight size={14} /></button></div>
    </article>
  }

  const dashboard = () => <>
    <section className="welcome-row"><div><p className="eyebrow">TEACHING-TO-REEL GENERATOR <span className="eyebrow-divider">/</span> {todayLabel}</p><h1>Make wisdom <em>move.</em></h1><p className="welcome-copy">Turn timeless teachings into stories for today’s generation.</p></div><button className="button-primary" onClick={() => setScreen('library')}><Plus size={17} /> Create a reel</button></section>
    <section className="hero-strip"><div className="hero-copy"><span className="hero-kicker"><Sparkles size={14} /> THE SOURCE IS THE START</span><h2>Big ideas deserve<br />a <em>new rhythm.</em></h2><p>Choose a teaching. Keep the original intact. Shape everything around it into a story worth sharing.</p><button className="hero-action" onClick={() => startTeaching(verifiedTeaching)}>Start with fearlessness <ArrowRight size={16} /></button></div><div className="hero-art" aria-label="Mountain landscape at sunrise"><div className="art-sun"/><div className="art-mountain art-mountain-back"/><div className="art-mountain art-mountain-front"/><div className="art-path"/><div className="art-caption"><span>01 / FEARLESSNESS</span><strong>A first step<br />changes the view.</strong></div><span className="art-note">STORYBOARD PREVIEW · 00:42</span></div></section>
    <section className="stats-row"><div className="stat-block"><span>VERIFIED TEACHINGS</span><strong>{String(verifiedTeachingCount).padStart(2, '0')} <small>/ {String(teachings.length).padStart(2, '0')}</small></strong><i><ShieldCheck size={14} /> All source linked</i></div><div className="stat-block"><span>REELS IN PROGRESS</span><strong>01</strong><i><Film size={14} /> Latest · 42 sec</i></div><div className="stat-block"><span>LANGUAGES READY</span><strong>02</strong><i><span className="language-pips"><b>EN</b><b>ಕ</b></span> English + Kannada</i></div></section>
    <section className="section-heading"><div><p className="eyebrow">START WITH A TEACHING</p><h2>Choose your starting point</h2></div><button className="text-link" onClick={() => setScreen('library')}>Browse all teachings <ArrowRight size={15} /></button></section>
    <section className="teaching-grid dashboard-grid">{teachings.slice(0, 3).map(teachingCard)}</section>
    <section className="recent-row"><div><span className="recent-icon"><Clapperboard size={18} /></span><div><strong>Courage starts before fear fades</strong><small>Fearlessness · Storytelling · English</small></div></div><span className="recent-status"><span /> Draft ready</span><button className="text-link" onClick={() => startTeaching(verifiedTeaching)}>Create this reel <ArrowRight size={15} /></button></section>
  </>

  const library = () => {
    const filtered = teachings.filter((teaching) => `${teaching.topic} ${teaching.category}`.toLowerCase().includes(searchText.toLowerCase()))
    const filteredLife = vivekmargLifeMoments.filter((moment) => `${moment.year} ${moment.title} ${moment.summary}`.toLowerCase().includes(searchText.toLowerCase()))
    const savedLifeMoments = vivekmargLifeMoments.filter((moment) => savedLifeMomentIds.includes(moment.id))
    const lifeMomentCard = (moment: VivekMargLifeMoment) => {
      const saved = savedLifeMomentIds.includes(moment.id)
      return <article className="life-moment-card" key={moment.id}>
        <div className="life-moment-meta"><span>{moment.year}</span><span>VIVEKMARG · LIFE TIMELINE</span></div>
        <h3>{moment.title}</h3>
        <p>{moment.summary}</p>
        <div className="life-card-footer"><a href={moment.source_url} target="_blank" rel="noreferrer">{moment.source_section} <ExternalLink size={12} /></a><div className="life-actions"><button className={saved ? 'life-save saved' : 'life-save'} onClick={() => toggleLifeMoment(moment.id)}>{saved ? <><Check size={13} /> In My Library</> : <><Plus size={13} /> Add to My Library</>}</button><button className="life-save create-reel" onClick={() => startLibraryMomentReel(moment)}><Sparkles size={13} /> Create reel</button></div></div>
      </article>
    }
    return <><section className="page-heading"><div><p className="eyebrow">THE KNOWLEDGE BASE</p><h1>Teaching library</h1><p>Every original passage stays tied to its source. Only source-verified teachings can be used for generation.</p></div><div className="library-counter"><strong>{String(verifiedTeachingCount).padStart(2, '0')}</strong><span>verified sources<br />of {String(teachings.length).padStart(2, '0')} records</span></div></section>
      <div className="library-tabs" role="tablist" aria-label="Library collections"><button role="tab" aria-selected={libraryTab === 'teachings'} className={libraryTab === 'teachings' ? 'selected' : ''} onClick={() => setLibraryTab('teachings')}><BookOpenText size={15} /> Verified teachings <span>{teachings.length}</span></button><button role="tab" aria-selected={libraryTab === 'vivekmarg'} className={libraryTab === 'vivekmarg' ? 'selected' : ''} onClick={() => setLibraryTab('vivekmarg')}><Clock3 size={15} /> VivekMarg life history <span>25</span></button><button role="tab" aria-selected={libraryTab === 'my-library'} className={libraryTab === 'my-library' ? 'selected' : ''} onClick={() => setLibraryTab('my-library')}><Library size={15} /> My Library <span>{savedLifeMoments.length}</span></button></div>
      {libraryTab !== 'my-library' && <div className="library-toolbar"><label className="search-field"><Search size={16} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder={libraryTab === 'teachings' ? 'Search a teaching or category' : 'Search a year or life moment'} /></label><span className="toolbar-note"><ShieldCheck size={14} /> {libraryTab === 'teachings' ? 'Original text is never generated' : 'Secondary life-history source · not a quote collection'}</span></div>}
      {libraryTab === 'teachings' && <><section className="teaching-grid library-grid">{filtered.map(teachingCard)}</section><div className="library-footnote"><LockKeyhole size={15} /><p><strong>Source integrity is non-negotiable.</strong> Original text and source references come from the verified knowledge base and are never generated or paraphrased by AI.</p></div></>}
      {libraryTab === 'vivekmarg' && <><div className="vivekmarg-source-note"><Clock3 size={16} /><p><strong>Life timeline · 1863–1902</strong><span>Summaries based on VivekMarg’s “A Life, Year by Year.” These are secondary life-history notes, not Swami Vivekananda quotations.</span></p><a href="https://vivekmarg.org/" target="_blank" rel="noreferrer">Open VivekMarg <ExternalLink size={13} /></a></div><section className="life-moment-grid">{filteredLife.map(lifeMomentCard)}</section></>}
      {libraryTab === 'my-library' && <>{savedLifeMoments.length ? <><p className="my-library-intro">Your saved VivekMarg life-history moments stay separate from original teaching records.</p><section className="life-moment-grid">{savedLifeMoments.map(lifeMomentCard)}</section></> : <div className="empty-publish"><Library size={20} /><div><strong>Your library is empty</strong><p>Add life-history moments from the VivekMarg timeline to build a personal collection.</p></div><button className="text-link" onClick={() => setLibraryTab('vivekmarg')}>Browse VivekMarg <ArrowRight size={14} /></button></div>}</>}
    </>
  }

  const sourceDetails = () => <><button className="back-link" onClick={() => setScreen('library')}><ArrowLeft size={15} /> Back to library</button><section className="source-layout"><div className="source-main"><p className="eyebrow">TEACHING RECORD · {selectedTeaching.id.toUpperCase()}</p><h1>{selectedTeaching.topic}<span className="title-period">.</span></h1><div className="source-status"><BadgeCheck size={17} /><span><strong>Source linked</strong><small>Exact passage held in the verified knowledge base</small></span><span className="source-status-right">VERIFIED</span></div><div className="quote-panel"><span className="quote-label"><BookOpenText size={14} /> ORIGINAL TEACHING</span><blockquote>“{selectedTeaching.original_text}”</blockquote><a className="source-reference" href={selectedTeaching.source_url ?? '#'} target="_blank" rel="noreferrer"><span><strong>{selectedTeaching.source}</strong><small>{selectedTeaching.source_type} · Open source text <ArrowRight size={12} /></small></span><ArrowRight size={16} /></a></div><div className="authenticity-note"><ShieldCheck size={18} /><p><strong>Protected from AI rewriting</strong><span>This exact text and its source are inserted by the application after generation. The model cannot supply or alter the original teaching.</span></p></div><button className="button-primary generate-button" onClick={generateReel}><Sparkles size={16} /> Generate reel <ArrowRight size={16} /></button></div><aside className="source-aside"><span className="aside-number">01</span><p className="eyebrow">BEFORE WE BEGIN</p><h3>Keep the words.<br /><em>Reframe the moment.</em></h3><p>The source remains unchanged. AI only helps build a modern story around it.</p><div className="aside-rule"/><span className="aside-meta"><ShieldCheck size={14} /> Checked against a public transcription</span></aside></section></>

  const pipeline = () => <section className="pipeline-page"><button className="back-link" onClick={() => setScreen('source')}><ArrowLeft size={15} /> Source details</button><div className="pipeline-content"><span className="pipeline-orbit"><span><Sparkles size={24} /></span></span><p className="eyebrow">BUILDING YOUR STORY</p><h1>Wisdom, in motion.</h1><p className="pipeline-description">We’re shaping a short-form story around a verified teaching.</p><div className="pipeline-list">{pipelineSteps.map((step, index) => <div className={`pipeline-item ${index < pipelineStep ? 'complete' : index === pipelineStep ? 'working' : ''}`} key={step}>{index < pipelineStep ? <span className="step-icon done"><Check size={14} /></span> : index === pipelineStep ? <span className="step-icon spin"><LoaderCircle size={15} /></span> : <span className="step-icon idle" />}<span>{step}</span><small>{index < pipelineStep ? 'READY' : index === pipelineStep ? 'IN PROGRESS' : 'WAITING'}</small></div>)}</div><p className="pipeline-trust"><LockKeyhole size={13} /> Original teaching and citation are locked</p></div></section>

  const storyboard = () => <><div className="review-top"><div><p className="eyebrow">YOUR STORY, BEFORE IT ROLLS</p><h1>Review the storyboard</h1><p>Make sure the original teaching and modern interpretation stay distinct.</p></div><div className="review-actions"><button className="button-secondary" onClick={() => setScreen('source')}><ArrowLeft size={15} /> Edit source</button><button className="button-primary" onClick={() => setScreen('reel')}>Preview reel <ArrowRight size={15} /></button></div></div>
    {error && <div className="inline-notice"><CircleHelp size={15} /> {error}<button onClick={() => setError('')} aria-label="Dismiss">×</button></div>}
    <div className="creator-controls"><div className="control-group"><span className="control-label">FORMAT</span><div className="segmented-control">{(['Storytelling', 'Quote focused', 'Question'] as Template[]).map((item) => <button className={template === item ? 'selected' : ''} key={item} onClick={() => setTemplate(item)}>{item}</button>)}</div></div><label className="language-select"><span className="control-label">SCRIPT LANGUAGE</span><span className="language-select-box">{language === 'Kannada' ? 'ಕನ್ನಡ' : 'English'} <ChevronDown size={14} /><select aria-label="Script language" value={language} onChange={(event) => setLanguage(event.target.value)}><option>English</option><option>Kannada</option></select></span></label><button className="button-secondary apply-options" disabled={isUpdatingScript} onClick={regenerateScript}>{isUpdatingScript ? <><LoaderCircle size={14} className="compose-spinner" /> Updating</> : 'Update storyboard'}</button></div>
    <div className="storyboard-list">{script.scenes.map((scene) => <article className={`scene-row ${scene.type === 'Original teaching' ? 'original-scene' : scene.type === 'AI interpretation' ? 'interpretation-scene' : ''}`} key={scene.scene_number}><div className="scene-index"><span>{String(scene.scene_number).padStart(2, '0')}</span><i /></div><div className="scene-content"><div className="scene-label-row"><span className="scene-type">{scene.type === 'Original teaching' ? <><ShieldCheck size={13} /> ORIGINAL TEACHING</> : scene.type === 'AI interpretation' ? <><Sparkles size={13} /> AI INTERPRETATION · NOT AN ORIGINAL QUOTE</> : scene.type.toUpperCase()}</span><span className="scene-time">{scene.duration}s</span></div><p className="scene-text">{scene.on_screen_text}</p>{scene.type === 'Original teaching' && <a className="scene-source" href={selectedTeaching.source_url ?? '#'} target="_blank" rel="noreferrer">Source: {script.source} <ArrowRight size={12} /></a>}{scene.type !== 'Original teaching' && scene.type !== 'AI interpretation' && <p className="scene-visual"><span>VISUAL</span>{scene.visual_description}</p>}</div><span className="scene-duration">{scene.duration}s</span></article>)}</div>
    <div className="storyboard-footer"><span>{script.duration} sec <i /> 9:16 vertical <i /> {script.scenes.length} scenes</span><button className="button-primary" onClick={() => setScreen('reel')}><Play size={15} fill="currentColor" /> Preview final reel</button></div></>

  const distribution = () => {
    const publishableReels = localReels.filter((reel) => reel.teaching_id)
    const selectedReel = publishableReels.find((reel) => reel.id === selectedUploadReelId)
    return <>
      <section className="page-heading"><div><p className="eyebrow">DISTRIBUTION WORKSPACE</p><h1>Publish &amp; analytics</h1><p>Send a source-backed reel to YouTube Shorts and track its performance.</p></div><div className="library-counter"><strong>{socialPosts.length.toString().padStart(2, '0')}</strong><span>YouTube posts<br />from this studio</span></div></section>
      {socialError && <div className="inline-notice"><CircleHelp size={15} /> {socialError}<button onClick={() => setSocialError('')} aria-label="Dismiss">×</button></div>}
      {socialMessage && <div className="social-success"><Check size={15} /> {socialMessage}</div>}
      <section className="social-channel-band"><div className="social-channel-icon"><Video size={20} /></div><div className="social-channel-copy"><span className="control-label">DIRECT PUBLISHING</span><h2>YouTube Shorts</h2><p>{youtubeStatus.connected ? `Connected to ${youtubeStatus.channel?.title ?? 'your channel'}` : youtubeStatus.configured ? 'Connect your channel to publish and see analytics.' : 'Set up Google OAuth credentials to enable publishing.'}</p></div><div className="social-channel-action">{youtubeStatus.connected ? <><span className="connected-pill"><span /> CONNECTED</span><button className="button-secondary" onClick={disconnectYouTube}>Disconnect</button></> : <a className={`button-primary ${youtubeStatus.configured ? '' : 'disabled-link'}`} href={youtubeStatus.configured ? '/api/social/youtube/connect' : undefined} onClick={(event) => { if (!youtubeStatus.configured) event.preventDefault() }}><Share2 size={15} /> {youtubeStatus.configured ? 'Connect YouTube' : 'OAuth setup required'}</a>}</div></section>
      <section className="publish-section"><div className="section-heading"><div><p className="eyebrow">READY TO PUBLISH</p><h2>Choose a verified reel</h2></div><span className="toolbar-note"><ShieldCheck size={14} /> Source travels with the upload</span></div>
        {publishableReels.length ? <div className="publish-grid"><div className="publish-form"><label className="publish-field"><span className="control-label">REEL</span><span className="language-select-box reel-select-box"><span>{selectedReel?.title ?? selectedReel?.topic ?? 'Choose a reel'}</span><select aria-label="Reel to publish" value={selectedReel?.id ?? ''} onChange={(event) => { setSelectedUploadReelId(event.target.value); const reel = publishableReels.find((item) => item.id === event.target.value); setPublishTitle(reel?.title ?? '') }}>{publishableReels.map((reel) => <option value={reel.id} key={reel.id}>{reel.title ?? reel.topic ?? 'Teaching reel'} · {reel.topic ?? 'Source verified'} · {new Date(reel.created_at).toLocaleDateString()}</option>)}</select><ChevronDown size={14} /></span></label>
          <label className="publish-field"><span className="control-label">SHORT TITLE</span><input maxLength={100} value={publishTitle || selectedReel?.title || ''} onChange={(event) => setPublishTitle(event.target.value)} placeholder={selectedReel?.title ?? 'Teaching reel title'} /></label>
          <label className="publish-field"><span className="control-label">VISIBILITY</span><span className="language-select-box"><span>{publishPrivacy === 'private' ? 'Private · review first' : publishPrivacy === 'unlisted' ? 'Unlisted · link only' : 'Public'}</span><select aria-label="YouTube visibility" value={publishPrivacy} onChange={(event) => setPublishPrivacy(event.target.value)}><option value="private">Private · recommended for review</option><option value="unlisted">Unlisted · link only</option><option value="public">Public</option></select><ChevronDown size={14} /></span></label>
          <div className="publish-source-note"><ShieldCheck size={16} /><span>The upload description includes the exact original teaching and its source. The AI interpretation is labeled separately.</span></div>
          <button className="button-primary" disabled={!youtubeStatus.connected || publishing || !selectedReel} onClick={publishToYouTube}>{publishing ? <><LoaderCircle size={15} className="compose-spinner" /> Uploading...</> : <><Upload size={15} /> Publish to YouTube Shorts</>}</button>
        </div><div className="publish-preview"><div className="publish-preview-label"><Clapperboard size={16} /><span>VERTICAL VIDEO</span><strong>9:16</strong></div><video className="publish-video" controls playsInline src={selectedReel?.video_url ?? ''} /><div className="publish-preview-footer"><span>{selectedReel?.topic ?? 'Select a reel'}</span><span>{selectedReel ? `${Math.round(selectedReel.bytes / 1024 / 1024 * 10) / 10} MB` : ''}</span></div></div></div> : <div className="empty-publish"><Clapperboard size={20} /><div><strong>No source-linked exports yet</strong><p>Generate and export a reel first. Only reels with a saved verified teaching can be published.</p></div><button className="text-link" onClick={() => setScreen('library')}>Choose a teaching <ArrowRight size={14} /></button></div>}
      </section>
      <section className="analytics-section"><div className="section-heading"><div><p className="eyebrow">CHANNEL PERFORMANCE</p><h2>Recent YouTube Shorts</h2></div><span className="toolbar-note"><Activity size={14} /> Analytics can take 24–48 hours to update</span></div>
        {socialPosts.length ? <div className="post-list">{socialPosts.map((post) => <article className="post-row" key={post.video_id}><div className="post-icon"><Video size={16} /></div><div className="post-info"><strong>{post.title}</strong><small>{post.topic} · {post.privacy_status} · {new Date(post.published_at).toLocaleDateString()}</small></div><a className="post-open" href={post.watch_url} target="_blank" rel="noreferrer">Open <ExternalLink size={13} /></a><button className="button-secondary analytics-refresh" disabled={analyticsLoading} onClick={() => refreshAnalytics(post.video_id)}><RefreshCw size={14} className={analyticsLoading ? 'compose-spinner' : ''} /> Refresh</button>{socialAnalytics?.video_id === post.video_id && <div className="post-metrics"><div><Eye size={14} /><strong>{socialAnalytics.views.toLocaleString()}</strong><small>Views</small></div><div><Heart size={14} /><strong>{socialAnalytics.likes.toLocaleString()}</strong><small>Likes</small></div><div><MessageCircle size={14} /><strong>{socialAnalytics.comments.toLocaleString()}</strong><small>Comments</small></div><div><Share2 size={14} /><strong>{socialAnalytics.shares.toLocaleString()}</strong><small>Shares</small></div><div><Clock3 size={14} /><strong>{socialAnalytics.average_view_seconds.toFixed(1)}s</strong><small>Avg. view</small></div>{socialAnalytics.note && <p>{socialAnalytics.note}</p>}</div>}</article>)}</div> : <div className="empty-publish"><BarChart3 size={20} /><div><strong>No published reels yet</strong><p>Once you publish, views, likes, comments, shares, and average watch time appear here.</p></div></div>}
      </section>
      <section className="share-elsewhere"><div><p className="eyebrow">OTHER PLATFORMS</p><h2>Take the reel with you</h2><p>Direct publishing is not connected for these platforms yet. Download the MP4 to upload it yourself.</p></div><div className="share-platforms"><a className="button-secondary" href={(selectedReel?.video_url ?? videoUrl) || undefined} download><Camera size={15} /> Instagram Reels <Download size={14} /></a><a className="button-secondary" href={(selectedReel?.video_url ?? videoUrl) || undefined} download><Music2 size={15} /> TikTok <Download size={14} /></a></div></section>
    </>
  }

  const reelPreview = () => <><div className="review-top"><div><p className="eyebrow">READY FOR THE NEXT STEP</p><h1>Your reel is ready.</h1><p>{script.duration} seconds · 9:16 vertical · Source included</p></div><div className="review-actions"><button className="button-secondary" onClick={() => setScreen('storyboard')}><ArrowLeft size={15} /> Storyboard</button><button className="button-primary" onClick={() => setScreen('distribution')}><Share2 size={15} /> Publish &amp; analytics</button><button className="button-secondary" onClick={() => { setScreen('library'); setSearchText('') }}><Plus size={15} /> Create another</button></div></div>
    <div className="reel-screen"><div className="reel-device">{videoUrl ? <video className="rendered-video" controls playsInline src={videoUrl} /> : <div className="reel-video"><div className="reel-top-meta"><span>STILLFIRE ORIGINAL</span><span>•••</span></div><div className="reel-sun"/><div className="reel-range range-one"/><div className="reel-range range-two"/><div className="reel-copy"><span>{selectedTeaching.topic.toUpperCase()} · 01</span><h2>{script.hook}</h2><p>{script.takeaway}</p></div><div className="reel-subtitle">{script.hook}</div><div className="reel-bottom-meta"><span>stillfire.studio</span><span>00:{String(script.duration).padStart(2, '0')}</span></div></div>}</div><div className="reel-details"><span className="ready-pill"><Check size={13} /> {videoUrl ? 'MP4 COMPOSED' : 'DEMO PREVIEW READY'}</span><span className={`video-provider-pill ${videoMode === 'google-veo-3.1' ? 'enabled' : ''}`}>{videoMode === 'google-veo-3.1' ? 'VEO 3.1 · READY' : 'AI VIDEO · TOKEN REQUIRED'}</span><h2>{script.title}</h2><p className="reel-topic">{selectedTeaching.topic} <i /> {script.duration} sec <i /> {language}</p><div className="reel-source-card"><ShieldCheck size={17} /><div><strong>Original teaching included</strong><small>{script.source}</small><a href={selectedTeaching.source_url ?? '#'} target="_blank" rel="noreferrer">View source <ArrowRight size={12} /></a></div></div><p className="export-note">{videoUrl ? `The MP4 includes ${videoMode === 'google-veo-3.1' ? 'a Veo-generated hook scene, ' : ''}storyboard cards, captions, the source reference, and ${voiceoverType === 'unavailable' ? 'no voice track' : `${voiceoverType} narration`}.` : videoMode === 'google-veo-3.1' ? 'Generates one 6-second 9:16 Veo 3.1 hook clip, then adds verified cards and narration. Replicate usage is billed per generation.' : 'Set REPLICATE_API_TOKEN to enable real Veo 3.1 video. Without it, export uses the local motion-card fallback.'}</p>{isComposing && <div className="video-job-progress"><div><span>{videoProgress.message || 'Starting video job...'}</span><strong>{videoProgress.progress}%</strong></div><progress max="100" value={videoProgress.progress} /></div>}<div className="reel-actions"><button className="button-primary" onClick={speakNarration}><Volume2 size={16} /> {isSpeaking ? 'Stop voiceover' : 'Play voiceover'}</button>{videoUrl ? <a className="button-secondary download-link" href={videoUrl} download={`${script.title.toLowerCase().replaceAll(' ', '-')}.mp4`}><Download size={16} /> Download MP4</a> : <button className="button-secondary" disabled={isComposing} onClick={composeVideo}>{isComposing ? <><LoaderCircle size={16} className="compose-spinner" /> {videoMode === 'google-veo-3.1' ? 'Generating Veo video...' : 'Composing...'}</> : <><Download size={16} /> {videoMode === 'google-veo-3.1' ? 'Generate AI video + MP4' : 'Export MP4'}</>}</button>}</div>{error && <div className="inline-notice"><CircleHelp size={15} /> {error}</div>}</div></div></>

  const title = screen === 'home' ? 'Overview' : screen === 'library' ? 'Teaching library' : screen === 'source' ? 'Source verification' : screen === 'pipeline' ? 'Reel creator' : screen === 'storyboard' ? 'Review storyboard' : screen === 'distribution' ? 'Publish & analytics' : 'Your reel'

  return <div className="app-shell"><aside className="sidebar"><button className="brand" onClick={() => setScreen('home')}><span className="brand-mark"><span /></span><span className="brand-name">stillfire<span>studio</span></span></button><div className="workspace-label">YOUR WORKSPACE</div><nav className="main-nav"><button className={`nav-item ${screen === 'home' ? 'active' : ''}`} onClick={() => setScreen('home')}><LayoutDashboard size={17} /> Overview</button><button className={`nav-item ${screen === 'library' ? 'active' : ''}`} onClick={() => setScreen('library')}><Library size={17} /> Teaching library <span className="nav-count">07</span></button><button className={`nav-item ${screen === 'distribution' ? 'active' : ''}`} onClick={() => setScreen('distribution')}><Share2 size={17} /> Publishing &amp; analytics</button></nav><div className="sidebar-divider"/><div className="workspace-label recent-label">RECENT PROJECTS</div><button className="project-link" onClick={() => setScreen('storyboard')}><span className="project-dot"/> Courage, without fear <span className="project-duration">0:42</span></button><button className="new-project" onClick={() => setScreen('library')}><Plus size={15}/> New reel</button><div className="sidebar-bottom"><div className="verified-mini"><ShieldCheck size={17}/><span><strong>Source-first by design</strong><small>Every teaching is traceable</small></span></div><button className="help-button">About the project</button></div></aside>
    <main className="main-area"><header className="topbar"><div className="breadcrumbs"><span>Studio</span><span className="crumb-slash">/</span><strong>{title}</strong></div><div className="topbar-right"><span className="local-badge"><span/> Demo workspace</span><button className="icon-button" title="Search teachings" onClick={() => setScreen('library')}><Search size={17}/></button><span className="avatar">S</span></div></header><div className={`page-content page-${screen}`}>{screen === 'home' && dashboard()}{screen === 'library' && library()}{screen === 'source' && sourceDetails()}{screen === 'pipeline' && pipeline()}{screen === 'storyboard' && storyboard()}{screen === 'reel' && reelPreview()}{screen === 'distribution' && distribution()}</div><footer className="app-footer"><span>STILLFIRE STUDIO <i/> SOURCE-FIRST STORYTELLING</span><span>Demo build · v0.1</span></footer></main>
  </div>
}

export default App
