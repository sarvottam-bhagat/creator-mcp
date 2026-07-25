import { expect, it, vi } from 'vitest';

import { prepareGenerationPayload } from '../../lib/studio/generation-request';

it('persists a draft before building a narration request', async () => {
  const saveDraft = vi.fn().mockResolvedValue('episode-1');

  await expect(prepareGenerationPayload('narration', saveDraft)).resolves.toEqual({
    kind: 'narration',
    episodeId: 'episode-1',
  });
  expect(saveDraft).toHaveBeenCalledOnce();
});

it('includes the thumbnail prompt after persisting the draft', async () => {
  await expect(
    prepareGenerationPayload('thumbnail', async () => 'episode-1', 'A radio in rain'),
  ).resolves.toEqual({
    kind: 'thumbnail',
    episodeId: 'episode-1',
    prompt: 'A radio in rain',
  });
});
