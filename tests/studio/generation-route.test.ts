import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createStudioContext: vi.fn(),
  generateNarration: vi.fn(),
  generateThumbnail: vi.fn(),
}));

vi.mock('../../lib/server/studio/context', () => ({
  createStudioContext: mocks.createStudioContext,
}));

vi.mock('../../lib/server/studio/generation', () => ({
  generateNarration: mocks.generateNarration,
  generateThumbnail: mocks.generateThumbnail,
}));

import { POST } from '../../app/api/studio/generate/route';

describe('Studio generation API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    mocks.createStudioContext.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('generates narration for the persisted episode', async () => {
    mocks.generateNarration.mockResolvedValue(['user-1/episode-1/audio.mp3']);
    const request = new Request('http://localhost/api/studio/generate', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer signed-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ kind: 'narration', episodeId: 'episode-1' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ paths: ['user-1/episode-1/audio.mp3'] });
    expect(mocks.generateNarration).toHaveBeenCalledWith(
      expect.objectContaining({ user: { id: 'user-1' } }),
      'episode-1',
    );
  });

  it('rejects requests without a user bearer token', async () => {
    const response = await POST(new Request('http://localhost/api/studio/generate', {
      method: 'POST',
      body: JSON.stringify({ kind: 'narration', episodeId: 'episode-1' }),
    }));

    expect(response.status).toBe(401);
  });
});
