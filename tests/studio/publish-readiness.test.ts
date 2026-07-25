import { expect, it } from 'vitest';
import { getPublishBlockers } from '@/lib/studio/publish';

it('requires every creator choice and generated asset before publishing', () => {
  expect(
    getPublishBlockers({
      title: '', script: '', voice: null, musicTrackId: null,
      narrationPaths: [], thumbnailPath: null,
    }),
  ).toEqual(['title', 'script', 'voice', 'music', 'narration', 'thumbnail']);
});
