import { describe, expect, it, vi } from 'vitest';

import {
  createEpisodeService,
  type EpisodeRecord,
  type EpisodeRepository,
  type SeriesRecord,
} from '../../lib/server/studio/episodes';

function episode(overrides: Partial<EpisodeRecord> = {}): EpisodeRecord {
  return {
    id: 'episode-1',
    series_id: 'series-1',
    title: 'First Signal',
    script: 'At midnight, the old radio whispered Maya’s name.',
    voice: 'coral',
    music_track_id: 'night-drive',
    narration_paths: ['user-1/episode-1/narration-1.mp3'],
    thumbnail_path: 'user-1/episode-1/thumbnail.png',
    thumbnail_prompt: 'A radio in the rain',
    status: 'draft',
    published_at: null,
    created_at: '2026-07-25T00:00:00.000Z',
    updated_at: '2026-07-25T00:00:00.000Z',
    ...overrides,
  };
}

function repository(initialEpisode: EpisodeRecord | null = null): EpisodeRepository {
  const series: SeriesRecord = {
    id: 'series-1',
    creator_id: 'user-1',
    title: 'Signals',
    description: '',
    created_at: '2026-07-25T00:00:00.000Z',
    updated_at: '2026-07-25T00:00:00.000Z',
  };
  let current = initialEpisode;

  return {
    listSeries: vi.fn().mockResolvedValue([series]),
    findSeries: vi.fn().mockResolvedValue(series),
    createSeries: vi.fn().mockResolvedValue(series),
    listEpisodes: vi.fn().mockImplementation(async () => (current ? [current] : [])),
    findEpisode: vi.fn().mockImplementation(async () => current),
    createEpisode: vi.fn().mockImplementation(async (input) => {
      current = episode({
        title: input.title,
        script: input.script,
        series_id: input.series_id,
        voice: null,
        music_track_id: null,
        narration_paths: [],
        thumbnail_path: null,
        thumbnail_prompt: '',
        status: 'draft',
      });
      return current;
    }),
    updateEpisode: vi.fn().mockImplementation(async (_id, patch) => {
      current = current ? { ...current, ...patch } : null;
      return current;
    }),
    findMusicTrack: vi.fn().mockImplementation(async (id) =>
      id === 'night-drive'
        ? { id, title: 'Night Drive', mood: 'Cinematic', duration_seconds: 138, asset_key: 'a-tales' }
        : null,
    ),
  };
}

describe('episode service', () => {
  it('always creates MCP episodes as private drafts', async () => {
    const repo = repository();
    const service = createEpisodeService({ userId: 'user-1', repository: repo });

    const created = await service.createEpisode({
      seriesTitle: 'Signals',
      title: 'First Signal',
      script: 'At midnight...',
    });

    expect(created).toMatchObject({ status: 'draft', published_at: null });
    expect(repo.createSeries).toHaveBeenCalledWith({ creator_id: 'user-1', title: 'Signals' });
  });

  it('does not reveal an episode outside the scoped repository', async () => {
    const service = createEpisodeService({ userId: 'user-1', repository: repository() });

    await expect(service.getEpisode('other-user-episode')).rejects.toMatchObject({
      code: 'not_found',
      status: 404,
    });
  });

  it('rejects edits to published episodes', async () => {
    const service = createEpisodeService({
      userId: 'user-1',
      repository: repository(episode({ status: 'published', published_at: '2026-07-25T01:00:00.000Z' })),
    });

    await expect(service.updateEpisode('episode-1', { title: 'Changed' })).rejects.toMatchObject({
      code: 'invalid_input',
    });
  });

  it('validates voice and music catalog selections', async () => {
    const service = createEpisodeService({ userId: 'user-1', repository: repository(episode()) });

    await expect(service.selectVoice('episode-1', 'unknown')).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(service.selectMusic('episode-1', 'missing-track')).rejects.toMatchObject({ code: 'invalid_input' });
  });

  it('requires explicit confirmation and complete readiness before publishing', async () => {
    const readyService = createEpisodeService({ userId: 'user-1', repository: repository(episode()) });
    await expect(readyService.publishEpisode('episode-1', false)).rejects.toMatchObject({ code: 'invalid_input' });

    const incompleteService = createEpisodeService({
      userId: 'user-1',
      repository: repository(episode({ narration_paths: [], thumbnail_path: null })),
    });
    await expect(incompleteService.publishEpisode('episode-1', true)).rejects.toMatchObject({
      code: 'not_ready',
      message: expect.stringContaining('narration'),
    });

    await expect(readyService.publishEpisode('episode-1', true)).resolves.toMatchObject({
      status: 'published',
      published_at: expect.any(String),
    });
  });
});
