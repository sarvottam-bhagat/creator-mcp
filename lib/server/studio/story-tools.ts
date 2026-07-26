import OpenAI from 'openai';

import type { StudioContext } from './context';
import { createEpisodeServiceForContext, type EpisodeRecord } from './episodes';
import { StudioError } from './errors';

export type ContinuityIssue = {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  episode_ids: string[];
  evidence: string;
  suggested_fix: string;
};

export type ContinuityReport = {
  series_id: string;
  episodes_analyzed: number;
  summary: string;
  issues: ContinuityIssue[];
};

const continuitySchema = {
  type: 'object', additionalProperties: false,
  required: ['summary', 'issues'],
  properties: {
    summary: { type: 'string' },
    issues: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['id', 'severity', 'title', 'description', 'episode_ids', 'evidence', 'suggested_fix'],
      properties: {
        id: { type: 'string' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] }, title: { type: 'string' },
        description: { type: 'string' }, episode_ids: { type: 'array', items: { type: 'string' } }, evidence: { type: 'string' }, suggested_fix: { type: 'string' },
      },
    } },
  },
} as const;

const rewriteSchema = {
  type: 'object', additionalProperties: false, required: ['title', 'script', 'summary'],
  properties: { title: { type: 'string' }, script: { type: 'string' }, summary: { type: 'string' } },
} as const;

function client(apiKey = process.env.OPENAI_API_KEY) {
  if (!apiKey) throw new StudioError('dependency_failed', 'OpenAI analysis is not configured.', 503);
  return new OpenAI({ apiKey });
}

export async function analyzeStoryContinuity(context: StudioContext, seriesId: string) {
  const episodes = createEpisodeServiceForContext(context);
  const items = await episodes.listEpisodes({ seriesId });
  if (!items.length) throw new StudioError('not_found', 'No creator-owned episodes were found in that series.', 404);
  const corpus = items.map((episode, index) => `EPISODE ${index + 1}\nID: ${episode.id}\nTitle: ${episode.title}\nStatus: ${episode.status}\nScript:\n${episode.script || '[No script yet]'}`).join('\n\n---\n\n');
  try {
    const response = await client().responses.create({
      model: 'gpt-4o-mini',
      instructions: 'You are EchoFM’s story continuity editor. Review only the supplied series. Identify objective or plausible continuity problems: timeline, knowledge, character, location, objects, unresolved setup, or direct contradictions. Do not invent missing facts. Return JSON only. This is advisory and must not modify any episode.',
      input: corpus,
      text: { format: { type: 'json_schema', name: 'continuity_report', strict: true, schema: continuitySchema } },
    });
    if (!response.output_text) throw new Error('OpenAI returned no continuity report.');
    const parsed = JSON.parse(response.output_text) as Omit<ContinuityReport, 'series_id' | 'episodes_analyzed'>;
    return { ...parsed, series_id: seriesId, episodes_analyzed: items.length } satisfies ContinuityReport;
  } catch (error) {
    if (error instanceof StudioError) throw error;
    throw new StudioError('dependency_failed', 'Story continuity analysis could not be completed. Please try again.', 502);
  }
}

export async function rewriteEpisodeAsDraft(
  context: StudioContext,
  episodeId: string,
  input: { instruction: string; genre?: string; tone?: string },
) {
  const episodes = createEpisodeServiceForContext(context);
  const source = await episodes.getEpisode(episodeId);
  if (!source.script.trim()) throw new StudioError('invalid_input', 'Write a script before requesting a rewrite.', 400);
  const cleanInstruction = input.instruction.trim();
  if (!cleanInstruction) throw new StudioError('invalid_input', 'Describe the rewrite you want.', 400);
  try {
    const response = await client().responses.create({
      model: 'gpt-4o-mini',
      instructions: 'You are EchoFM’s episode rewrite editor. Rewrite the supplied episode according to the request while preserving the core plot, named characters, key events, and factual story continuity unless the request explicitly changes them. Produce a complete revised episode script. Return JSON only. Never publish.',
      input: `Rewrite request: ${cleanInstruction}\nGenre: ${input.genre?.trim() || 'preserve'}\nTone: ${input.tone?.trim() || 'preserve'}\n\nOriginal title: ${source.title}\nOriginal script:\n${source.script}`,
      text: { format: { type: 'json_schema', name: 'episode_rewrite', strict: true, schema: rewriteSchema } },
    });
    if (!response.output_text) throw new Error('OpenAI returned no rewrite.');
    const rewritten = JSON.parse(response.output_text) as { title: string; script: string; summary: string };
    const episode = await episodes.createEpisode({
      seriesId: source.series_id,
      title: rewritten.title.trim() || `${source.title} — Rewrite`,
      script: rewritten.script.trim(),
    });
    return { source_episode_id: source.id, rewrite_summary: rewritten.summary, episode };
  } catch (error) {
    if (error instanceof StudioError) throw error;
    throw new StudioError('dependency_failed', 'Episode rewrite could not be completed. Please try again.', 502);
  }
}
