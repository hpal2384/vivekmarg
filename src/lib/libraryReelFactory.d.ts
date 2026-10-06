export type LibraryMoment = {
  id: string
  year: string
  title: string
  summary: string
  source_section: string
  source_url: string
}

export type LibraryReelScene = {
  scene_number: number
  duration: number
  type: string
  narration: string
  on_screen_text: string
  visual_description: string
}

export type LibraryReel = {
  title: string
  hook: string
  original_teaching: string
  source: string
  ai_interpretation: string
  takeaway: string
  language: string
  duration: number
  scenes: LibraryReelScene[]
}

export function buildLibraryMomentReel(moment: LibraryMoment): LibraryReel
