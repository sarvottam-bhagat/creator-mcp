import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createEchoFmMcpServer, type EchoFmMcpServices } from '../../mcp/server';

const episodeId = '00000000-0000-4000-8000-000000000001';

function services(): EchoFmMcpServices {
  return {
    episodes: {
      listSeries: vi.fn().mockResolvedValue([]),
      listEpisodes: vi.fn().mockResolvedValue([]),
      getEpisode: vi.fn(),
      createEpisode: vi.fn().mockResolvedValue({ id: episodeId, status: 'draft', title: 'First Signal' }),
      updateEpisode: vi.fn(),
      selectVoice: vi.fn(),
      selectMusic: vi.fn(),
      attachNarration: vi.fn(),
      attachThumbnail: vi.fn(),
      publishEpisode: vi.fn().mockResolvedValue({ id: episodeId, status: 'published' }),
    },
    listMusicTracks: vi.fn().mockResolvedValue([]),
    generateNarration: vi.fn().mockResolvedValue(['user-1/episode-1/audio.mp3']),
    generateThumbnail: vi.fn().mockResolvedValue('user-1/episode-1/thumbnail.png'),
    reviewEpisode: vi.fn().mockResolvedValue({ blockers: [] }),
  } as unknown as EchoFmMcpServices;
}

describe('EchoFM MCP tools', () => {
  let client: Client;
  let server: ReturnType<typeof createEchoFmMcpServer>;
  let dependencies: EchoFmMcpServices;

  beforeEach(async () => {
    dependencies = services();
    server = createEchoFmMcpServer(dependencies);
    client = new Client({ name: 'echofm-test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it('registers the complete EchoFM workflow', async () => {
    const result = await client.listTools();

    expect(result.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
      'list_voices',
      'list_music_tracks',
      'list_series',
      'list_episodes',
      'get_episode',
      'create_episode',
      'update_episode',
      'select_voice',
      'select_music',
      'generate_narration',
      'generate_thumbnail',
      'review_episode',
      'publish_episode',
      'list_published_episodes',
    ]));
  });

  it('creates drafts through the episode service', async () => {
    const result = await client.callTool({
      name: 'create_episode',
      arguments: { series_title: 'Signals', title: 'First Signal', script: 'At midnight...' },
    });

    expect(result.isError).not.toBe(true);
    expect(dependencies.episodes.createEpisode).toHaveBeenCalledWith({
      seriesTitle: 'Signals',
      seriesId: undefined,
      title: 'First Signal',
      script: 'At midnight...',
    });
  });

  it('publishes only with literal confirmation', async () => {
    await client.callTool({
      name: 'publish_episode',
      arguments: { episode_id: episodeId, confirm: true },
    });

    expect(dependencies.episodes.publishEpisode).toHaveBeenCalledWith(episodeId, true);
  });
});
