import { expect, it, vi } from 'vitest';

import { reviewEpisode, type ReviewDependencies } from '../../lib/server/studio/review';
import type { EpisodeRecord } from '../../lib/server/studio/episodes';
import type { StudioContext } from '../../lib/server/studio/context';

it('returns exact blockers and signed previews for owned episode assets', async () => {
  const item: EpisodeRecord = {
    id: 'episode-1',
    series_id: 'series-1',
    title: 'First Signal',
    script: 'At midnight...',
    voice: 'coral',
    music_track_id: 'night-drive',
    narration_paths: ['user-1/episode-1/audio.mp3'],
    thumbnail_path: 'user-1/episode-1/thumbnail.png',
    thumbnail_prompt: 'A radio in rain',
    status: 'draft',
    published_at: null,
    created_at: '2026-07-25T00:00:00.000Z',
    updated_at: '2026-07-25T00:00:00.000Z',
  };
  const dependencies: ReviewDependencies = {
    getEpisode: vi.fn().mockResolvedValue(item),
    findMusicTrack: vi.fn().mockResolvedValue({
      id: 'night-drive', title: 'Night Drive', mood: 'Cinematic', duration_seconds: 138, asset_key: 'a-tales',
    }),
    sign: vi.fn().mockImplementation(async (bucket, path) => `https://signed.example/${bucket}/${path}`),
  };

  const review = await reviewEpisode(
    { user: { id: 'user-1' } } as StudioContext,
    'episode-1',
    dependencies,
  );

  expect(review.blockers).toEqual([]);
  expect(review.music?.title).toBe('Night Drive');
  expect(review.audio).toEqual([
    {
      path: 'user-1/episode-1/audio.mp3',
      signedUrl: 'https://signed.example/episode-audio/user-1/episode-1/audio.mp3',
    },
  ]);
  expect(review.thumbnail?.signedUrl).toContain('episode-images/user-1/episode-1/thumbnail.png');
});

it('refuses to sign asset paths outside the authenticated user prefix', async () => {
  const dependencies: ReviewDependencies = {
    getEpisode: vi.fn().mockResolvedValue({
      narration_paths: ['other-user/episode-1/audio.mp3'],
      thumbnail_path: null,
      title: 'First Signal',
      script: 'At midnight...',
      voice: 'coral',
      music_track_id: 'night-drive',
    } as EpisodeRecord),
    findMusicTrack: vi.fn(),
    sign: vi.fn(),
  };

  await expect(
    reviewEpisode({ user: { id: 'user-1' } } as StudioContext, 'episode-1', dependencies),
  ).rejects.toMatchObject({ code: 'not_found' });
  expect(dependencies.sign).not.toHaveBeenCalled();
});
