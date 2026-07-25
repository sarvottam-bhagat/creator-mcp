type GenerationKind = 'narration' | 'thumbnail';

export async function prepareGenerationPayload(
  kind: GenerationKind,
  saveDraft: () => Promise<string>,
  prompt?: string,
) {
  const episodeId = await saveDraft();
  return kind === 'thumbnail'
    ? { kind, episodeId, prompt: prompt ?? '' }
    : { kind, episodeId };
}
