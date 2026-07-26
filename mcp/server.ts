import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import type { StudioContext } from '../lib/server/studio/context';
import {
  createEpisodeServiceForContext,
  createSupabaseEpisodeRepository,
  type EpisodeService,
  type MusicTrackRecord,
} from '../lib/server/studio/episodes';
import { StudioError } from '../lib/server/studio/errors';
import {
  generateNarration as generateEpisodeNarration,
  generateThumbnail as generateEpisodeThumbnail,
} from '../lib/server/studio/generation';
import {
  applyCliffhangerRewrite as applyEpisodeCliffhangerRewrite,
  scoreCliffhanger as scoreEpisodeCliffhanger,
  type CliffhangerAnalysis,
} from '../lib/server/studio/cliffhanger';
import { reviewEpisode as buildEpisodeReview, type EpisodeReview } from '../lib/server/studio/review';
import { analyzeStoryContinuity, rewriteEpisodeAsDraft, type ContinuityReport } from '../lib/server/studio/story-tools';
import { OPENAI_VOICES } from '../lib/studio/voices';

export type EchoFmMcpServices = {
  episodes: EpisodeService;
  listMusicTracks(): Promise<MusicTrackRecord[]>;
  generateNarration(episodeId: string): Promise<string[]>;
  generateThumbnail(episodeId: string, prompt: string): Promise<string>;
  reviewEpisode(episodeId: string): Promise<EpisodeReview>;
  scoreCliffhanger(episodeId: string, input: { genre?: string; target?: string }): Promise<CliffhangerAnalysis>;
  applyCliffhangerRewrite(episodeId: string, ending: string): ReturnType<EpisodeService['updateEpisode']>;
  analyzeStoryContinuity(seriesId: string): Promise<ContinuityReport>;
  rewriteEpisodeAsDraft(episodeId: string, input: { instruction: string; genre?: string; tone?: string }): Promise<unknown>;
};

export function createEchoFmMcpServices(context: StudioContext): EchoFmMcpServices {
  const episodes = createEpisodeServiceForContext(context);
  const repository = createSupabaseEpisodeRepository(context);
  return {
    episodes,
    listMusicTracks: repository.listMusicTracks,
    generateNarration: (episodeId) => generateEpisodeNarration(context, episodeId),
    generateThumbnail: (episodeId, prompt) => generateEpisodeThumbnail(context, episodeId, prompt),
    reviewEpisode: (episodeId) => buildEpisodeReview(context, episodeId),
    scoreCliffhanger: (episodeId, input) => scoreEpisodeCliffhanger(context, episodeId, input),
    applyCliffhangerRewrite: (episodeId, ending) => applyEpisodeCliffhangerRewrite(context, episodeId, ending),
    analyzeStoryContinuity: (seriesId) => analyzeStoryContinuity(context, seriesId),
    rewriteEpisodeAsDraft: (episodeId, input) => rewriteEpisodeAsDraft(context, episodeId, input),
  };
}

function asStructuredContent(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return { items: value };
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  return { value };
}

async function runTool(summary: string, action: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    const value = await action();
    return {
      content: [{ type: 'text' as const, text: summary }],
      structuredContent: asStructuredContent(value),
    };
  } catch (error) {
    const safe = error instanceof StudioError
      ? error
      : new StudioError('dependency_failed', 'EchoFM could not complete that action.', 500);
    return {
      isError: true,
      content: [{ type: 'text' as const, text: safe.message }],
      structuredContent: { error: { code: safe.code, message: safe.message } },
    };
  }
}

export function createEchoFmMcpServer(services: EchoFmMcpServices): McpServer {
  const server = new McpServer({ name: 'echofm-studio', version: '1.0.0' });

  server.registerTool('list_voices', {
    description: 'List the OpenAI narration voices available in EchoFM Studio.',
    inputSchema: {},
  }, async () => runTool('Available EchoFM narration voices.', async () => [...OPENAI_VOICES]));

  server.registerTool('list_music_tracks', {
    description: 'List the background-music tracks available in EchoFM Studio.',
    inputSchema: {},
  }, async () => runTool('Available EchoFM background music.', services.listMusicTracks));

  server.registerTool('list_series', {
    description: 'List the authenticated creator’s EchoFM series.',
    inputSchema: {},
  }, async () => runTool('Your EchoFM series.', services.episodes.listSeries));

  server.registerTool('list_episodes', {
    description: 'List the authenticated creator’s draft or published episodes.',
    inputSchema: {
      series_id: z.string().uuid().optional(),
      status: z.enum(['draft', 'published']).optional(),
    },
  }, async ({ series_id, status }) => runTool('Your EchoFM episodes.', () =>
    services.episodes.listEpisodes({ seriesId: series_id, status })));

  server.registerTool('list_published_episodes', {
    description: 'List the authenticated creator’s published episodes.',
    inputSchema: {},
  }, async () => runTool('Your published EchoFM episodes.', () =>
    services.episodes.listEpisodes({ status: 'published' })));

  server.registerTool('get_episode', {
    description: 'Get one creator-owned EchoFM episode.',
    inputSchema: { episode_id: z.string().uuid() },
  }, async ({ episode_id }) => runTool('EchoFM episode details.', () =>
    services.episodes.getEpisode(episode_id)));

  server.registerTool('create_episode', {
    description: 'Create a private EchoFM episode draft in an existing or new series.',
    inputSchema: {
      series_id: z.string().uuid().optional(),
      series_title: z.string().min(1).max(160).optional(),
      title: z.string().min(1).max(240),
      script: z.string().max(100_000).optional(),
    },
  }, async ({ series_id, series_title, title, script }) => runTool('Episode draft created.', () =>
    services.episodes.createEpisode({
      seriesId: series_id,
      seriesTitle: series_title,
      title,
      script,
    })));

  server.registerTool('update_episode', {
    description: 'Update the title or script of a creator-owned draft.',
    inputSchema: {
      episode_id: z.string().uuid(),
      title: z.string().min(1).max(240).optional(),
      script: z.string().max(100_000).optional(),
    },
  }, async ({ episode_id, title, script }) => runTool('Episode draft updated.', () =>
    services.episodes.updateEpisode(episode_id, { title, script })));

  server.registerTool('select_voice', {
    description: 'Select an OpenAI narration voice for a creator-owned draft.',
    inputSchema: {
      episode_id: z.string().uuid(),
      voice: z.enum(OPENAI_VOICES.map((voice) => voice.id) as [string, ...string[]]),
    },
  }, async ({ episode_id, voice }) => runTool('Narration voice selected.', () =>
    services.episodes.selectVoice(episode_id, voice)));

  server.registerTool('select_music', {
    description: 'Select an EchoFM background-music track for a creator-owned draft.',
    inputSchema: { episode_id: z.string().uuid(), music_track_id: z.string().min(1) },
  }, async ({ episode_id, music_track_id }) => runTool('Background music selected.', () =>
    services.episodes.selectMusic(episode_id, music_track_id)));

  server.registerTool('generate_narration', {
    description: 'Generate and privately store narration for the draft’s saved script and voice.',
    inputSchema: { episode_id: z.string().uuid() },
  }, async ({ episode_id }) => runTool('Narration generated.', async () => ({
    paths: await services.generateNarration(episode_id),
  })));

  server.registerTool('generate_thumbnail', {
    description: 'Generate and privately store episode art from a prompt.',
    inputSchema: { episode_id: z.string().uuid(), prompt: z.string().min(1).max(32_000) },
  }, async ({ episode_id, prompt }) => runTool('Episode thumbnail generated.', async () => ({
    path: await services.generateThumbnail(episode_id, prompt),
  })));

  server.registerTool('review_episode', {
    description: 'Review an episode’s readiness and receive private preview links.',
    inputSchema: { episode_id: z.string().uuid() },
  }, async ({ episode_id }) => runTool('Episode review ready.', () =>
    services.reviewEpisode(episode_id)));

  server.registerTool('score_cliffhanger', {
    description: 'Privately analyze a draft ending for listener retention and return three stronger ending options plus a next-episode hook. This never edits or publishes the episode.',
    inputSchema: {
      episode_id: z.string().uuid(),
      genre: z.string().min(1).max(80).optional(),
      target: z.enum(['binge_listening', 'suspense', 'emotional_payoff']).optional(),
    },
  }, async ({ episode_id, genre, target }) => runTool('Cliffhanger analysis ready.', () =>
    services.scoreCliffhanger(episode_id, { genre, target })));

  server.registerTool('apply_cliffhanger_rewrite', {
    description: 'After the creator selects an ending option, replace only the final section of a creator-owned draft. This never publishes the episode.',
    inputSchema: { episode_id: z.string().uuid(), ending: z.string().min(10).max(4_000) },
  }, async ({ episode_id, ending }) => runTool('Cliffhanger rewrite saved to your private draft.', () =>
    services.applyCliffhangerRewrite(episode_id, ending)));

  server.registerTool('analyze_story_continuity', {
    description: 'Read a creator-owned series and return continuity issues with evidence and safe suggested fixes. This never edits, generates assets, or publishes.',
    inputSchema: { series_id: z.string().uuid() },
  }, async ({ series_id }) => runTool('Story continuity report ready.', () => services.analyzeStoryContinuity(series_id)));

  server.registerTool('rewrite_episode_script', {
    description: 'Create a new private draft rewrite of a creator-owned episode. The original is preserved and nothing is published.',
    inputSchema: { episode_id: z.string().uuid(), instruction: z.string().min(5).max(4_000), genre: z.string().max(80).optional(), tone: z.string().max(80).optional() },
  }, async ({ episode_id, instruction, genre, tone }) => runTool('Rewritten episode saved as a new private draft.', () =>
    services.rewriteEpisodeAsDraft(episode_id, { instruction, genre, tone })));

  server.registerTool('publish_episode', {
    description: 'Publish a ready episode after explicit creator confirmation.',
    inputSchema: { episode_id: z.string().uuid(), confirm: z.literal(true) },
  }, async ({ episode_id, confirm }) => runTool('Episode published.', () =>
    services.episodes.publishEpisode(episode_id, confirm)));

  return server;
}
