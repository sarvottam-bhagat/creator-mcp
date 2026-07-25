export const OPENAI_VOICES = [
  { id: 'marin', label: 'Marin', description: 'Warm and natural' },
  { id: 'cedar', label: 'Cedar', description: 'Grounded and calm' },
  { id: 'alloy', label: 'Alloy', description: 'Balanced and clear' },
  { id: 'ash', label: 'Ash', description: 'Steady and direct' },
  { id: 'ballad', label: 'Ballad', description: 'Expressive and soft' },
  { id: 'coral', label: 'Coral', description: 'Bright and friendly' },
  { id: 'echo', label: 'Echo', description: 'Confident and smooth' },
  { id: 'fable', label: 'Fable', description: 'Characterful and vivid' },
  { id: 'onyx', label: 'Onyx', description: 'Deep and composed' },
  { id: 'nova', label: 'Nova', description: 'Energetic and crisp' },
  { id: 'sage', label: 'Sage', description: 'Thoughtful and composed' },
  { id: 'shimmer', label: 'Shimmer', description: 'Light and bright' },
  { id: 'verse', label: 'Verse', description: 'Versatile and lively' },
] as const;

export type OpenAiVoice = (typeof OPENAI_VOICES)[number]['id'];
