import OpenAI from 'openai';

import type { StudioContext } from './context';
import { createEpisodeServiceForContext, type EpisodeRecord } from './episodes';
import { StudioError } from './errors';

export type CliffhangerOption = {
  id: 'option_1' | 'option_2' | 'option_3';
  title: string;
  ending: string;
  rationale: string;
};

export type CliffhangerAnalysis = {
  score: number;
  strengths: string[];
  improvements: string[];
  next_episode_hook: string;
  options: CliffhangerOption[];
};

type AnalysisDependencies = {
  getEpisode(id: string): Promise<EpisodeRecord>;
  analyze(input: { script: string; genre?: string; target: string }): Promise<CliffhangerAnalysis>;
};

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['score', 'strengths', 'improvements', 'next_episode_hook', 'options'],
  properties: {
    score: { type: 'integer', minimum: 0, maximum: 100 },
    strengths: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
    improvements: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
    next_episode_hook: { type: 'string' },
    options: {
      type: 'array', minItems: 3, maxItems: 3,
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'title', 'ending', 'rationale'],
        properties: {
          id: { type: 'string', enum: ['option_1', 'option_2', 'option_3'] },
          title: { type: 'string' }, ending: { type: 'string' }, rationale: { type: 'string' },
        },
      },
    },
  },
} as const;

function ensureDraft(episode: EpisodeRecord) {
  if (episode.status !== 'draft') {
    throw new StudioError('invalid_input', 'Published episodes are read-only. Create or select a draft before rewriting its ending.', 409);
  }
}

export function replaceFinalSection(script: string, ending: string) {
  const cleanEnding = ending.trim();
  if (!cleanEnding) throw new StudioError('invalid_input', 'Choose a cliffhanger ending before applying it.', 400);
  const sections = script.trim().split(/\n\s*\n/);
  if (sections.length > 1) return [...sections.slice(0, -1), cleanEnding].join('\n\n');
  const sentences = script.trim().match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [];
  if (sentences.length > 1) return [...sentences.slice(0, -1).map((sentence) => sentence.trim()), cleanEnding].join(' ').trim();
  return cleanEnding;
}

export function createCliffhangerDependencies(context: StudioContext, apiKey = process.env.OPENAI_API_KEY): AnalysisDependencies {
  if (!apiKey) throw new StudioError('dependency_failed', 'OpenAI analysis is not configured.', 503);
  const episodes = createEpisodeServiceForContext(context);
  const openai = new OpenAI({ apiKey });
  return {
    getEpisode: episodes.getEpisode,
    async analyze({ script, genre, target }) {
      const response = await openai.responses.create({
        model: 'gpt-4o-mini',
        instructions: 'You are EchoFM’s cliffhanger editor. Analyze the story ending for listener retention. Return JSON only. Preserve the story’s facts, tone, characters, and safety. Each option must be a concise replacement for only the final section, not a complete episode. Do not claim certainty about audience behavior.',
        input: `Genre: ${genre?.trim() || 'auto-detect'}\nGoal: ${target}\n\nEpisode script:\n${script}`,
        text: { format: { type: 'json_schema', name: 'cliffhanger_analysis', strict: true, schema } },
      });
      if (!response.output_text) throw new Error('OpenAI returned no cliffhanger analysis.');
      return JSON.parse(response.output_text) as CliffhangerAnalysis;
    },
  };
}

export async function scoreCliffhanger(
  context: StudioContext,
  episodeId: string,
  input: { genre?: string; target?: string } = {},
  dependencies = createCliffhangerDependencies(context),
) {
  const episode = await dependencies.getEpisode(episodeId);
  ensureDraft(episode);
  if (episode.script.trim().length < 40) {
    throw new StudioError('invalid_input', 'Write a little more of the episode before analyzing its ending.', 400);
  }
  try {
    return await dependencies.analyze({ script: episode.script, genre: input.genre, target: input.target ?? 'binge_listening' });
  } catch (error) {
    if (error instanceof StudioError) throw error;
    throw new StudioError('dependency_failed', 'Cliffhanger analysis could not be completed. Please try again.', 502);
  }
}

export async function applyCliffhangerRewrite(context: StudioContext, episodeId: string, ending: string) {
  const episodes = createEpisodeServiceForContext(context);
  const episode = await episodes.getEpisode(episodeId);
  ensureDraft(episode);
  return episodes.updateEpisode(episodeId, { script: replaceFinalSection(episode.script, ending) });
}
