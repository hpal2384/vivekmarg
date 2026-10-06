export function buildLibraryMomentReel(moment) {
  const title = `${moment.year} · ${moment.title}`
  const hook = `What shaped ${moment.title.toLowerCase()} in the life of Swami Vivekananda?`
  const originalTeaching = moment.summary
  const source = 'VivekMarg · A Life, Year by Year'
  const aiInterpretation = 'This life moment shows how curiosity, service, and search shaped his path. The summary is historical context, not a direct quotation.'
  const takeaway = 'Every chapter of a life can become a clearer reason to keep searching.'

  return {
    title,
    hook,
    original_teaching: originalTeaching,
    source,
    ai_interpretation: aiInterpretation,
    takeaway,
    language: 'English',
    duration: 42,
    scenes: [
      {
        scene_number: 1,
        duration: 6,
        type: 'Hook',
        narration: hook,
        on_screen_text: `${moment.year} · ${moment.title.toUpperCase()}`,
        visual_description: 'A cinematic archive-style frame with a warm sunrise and a subtle timeline graphic.'
      },
      {
        scene_number: 2,
        duration: 7,
        type: 'Context',
        narration: originalTeaching,
        on_screen_text: 'LIFE MOMENT',
        visual_description: 'A map of India appears with the year and a quiet motion of memory.'
      },
      {
        scene_number: 3,
        duration: 8,
        type: 'Original teaching',
        narration: originalTeaching,
        on_screen_text: originalTeaching,
        visual_description: 'A bright source card with VivekMarg reference notes and a soft archival backdrop.'
      },
      {
        scene_number: 4,
        duration: 8,
        type: 'AI interpretation',
        narration: aiInterpretation,
        on_screen_text: 'AI INTERPRETATION · NOT A QUOTE',
        visual_description: 'A calm visual track showing a person walking toward a brighter horizon.'
      },
      {
        scene_number: 5,
        duration: 7,
        type: 'Modern takeaway',
        narration: takeaway,
        on_screen_text: 'KEEP LOOKING FOR THE NEXT STEP.',
        visual_description: 'A quiet path opens into the morning light as the final frame settles.'
      },
      {
        scene_number: 6,
        duration: 6,
        type: 'Closing',
        narration: 'The story reminds us that purpose grows in motion.',
        on_screen_text: 'PURPOSE GROWS IN MOTION.',
        visual_description: 'A final glowing horizon with closing text and a soft fade.'
      }
    ]
  }
}
