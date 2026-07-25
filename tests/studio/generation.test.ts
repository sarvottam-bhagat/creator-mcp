import { describe, expect, it, vi } from 'vitest';

import {
  generateNarration,
  generateThumbnail,
  splitForSpeech,
  type GenerationDependencies,
} from '../../lib/server/studio/generation';
import type { EpisodeRecord } from '../../lib/server/studio/episodes';
import type { StudioContext } from '../../lib/server/studio/context';

function episode(overrides: Partial<EpisodeRecord> = {}): EpisodeRecord {
  return {
    id: 'episode-1',
    series_id: 'series-1',
    title: 'First Signal',
    script: 'At midnight, the old radio whispered Maya’s name.',
    voice: 'coral',
    music_track_id: 'night-drive',
    narration_paths: ['user-1/episode-1/old/narration-1.mp3'],
    thumbnail_path: 'user-1/episode-1/old/thumbnail.png',
    thumbnail_prompt: 'Old prompt',
    status: 'draft',
    published_at: null,
    created_at: '2026-07-25T00:00:00.000Z',
    updated_at: '2026-07-25T00:00:00.000Z',
    ...overrides,
  };
}

const context = { user: { id: 'user-1' } } as StudioContext;

function dependencies(item = episode()): GenerationDependencies {
  return {
    getEpisode: vi.fn().mockResolvedValue(item),
    attachNarration: vi.fn().mockImplementation(async (_id, paths) => ({ ...item, narration_paths: paths })),
    attachThumbnail: vi.fn().mockImplementation(async (_id, prompt, path) => ({
      ...item,
      thumbnail_prompt: prompt,
      thumbnail_path: path,
    })),
    synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from('audio')),
    createImage: vi.fn().mockResolvedValue(Buffer.from('image')),
    upload: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    makeId: () => 'attempt-1',
  };
}

describe('splitForSpeech', () => {
  it('keeps every chunk below the configured input limit', () => {
    const chunks = splitForSpeech('radio '.repeat(1_000), 120);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 120)).toBe(true);
    expect(chunks.join(' ').split(/\s+/)).toHaveLength(1_000);
  });
});

describe('generation pipeline', () => {
  it('attaches narration only after every generated part uploads', async () => {
    const deps = dependencies(episode({ script: 'radio '.repeat(1_000) }));
    vi.mocked(deps.upload)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('storage failed'));

    await expect(generateNarration(context, 'episode-1', deps)).rejects.toMatchObject({
      code: 'dependency_failed',
    });

    expect(deps.attachNarration).not.toHaveBeenCalled();
    expect(deps.remove).toHaveBeenCalledWith(
      'episode-audio',
      ['user-1/episode-1/attempt-1/narration-1.mp3'],
    );
  });

  it('uses the stored voice and returns attached narration paths', async () => {
    const deps = dependencies();

    const paths = await generateNarration(context, 'episode-1', deps);

    expect(deps.synthesizeSpeech).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gpt-4o-mini-tts',
      voice: 'coral',
    }));
    expect(deps.attachNarration).toHaveBeenCalledWith('episode-1', paths);
    expect(paths).toEqual(['user-1/episode-1/attempt-1/narration-1.mp3']);
  });

  it('preserves the previous thumbnail when generation fails', async () => {
    const deps = dependencies();
    vi.mocked(deps.createImage).mockRejectedValue(new Error('image failed'));

    await expect(generateThumbnail(context, 'episode-1', 'A radio in rain', deps)).rejects.toMatchObject({
      code: 'dependency_failed',
    });
    expect(deps.attachThumbnail).not.toHaveBeenCalled();
  });
});
