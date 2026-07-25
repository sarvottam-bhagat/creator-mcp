import OpenAI from 'openai';

import type { OpenAiVoice } from '../../studio/voices';
import type { StudioContext } from './context';
import {
  createEpisodeServiceForContext,
  type EpisodeRecord,
} from './episodes';
import { StudioError } from './errors';

type SpeechRequest = {
  model: 'gpt-4o-mini-tts';
  voice: OpenAiVoice;
  input: string;
  response_format: 'mp3';
};

export type GenerationDependencies = {
  getEpisode(id: string): Promise<EpisodeRecord>;
  attachNarration(id: string, paths: string[]): Promise<EpisodeRecord>;
  attachThumbnail(id: string, prompt: string, path: string): Promise<EpisodeRecord>;
  synthesizeSpeech(input: SpeechRequest): Promise<Uint8Array>;
  createImage(prompt: string): Promise<Uint8Array>;
  upload(bucket: 'episode-audio' | 'episode-images', path: string, body: Uint8Array, contentType: string): Promise<void>;
  remove(bucket: 'episode-audio' | 'episode-images', paths: string[]): Promise<void>;
  makeId(): string;
};

export function splitForSpeech(script: string, maxLength = 3_900) {
  const chunks: string[] = [];
  let current = '';

  for (const originalWord of script.trim().split(/\s+/).filter(Boolean)) {
    let word = originalWord;
    while (word.length > maxLength) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      chunks.push(word.slice(0, maxLength));
      word = word.slice(maxLength);
    }
    if (!word) continue;
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function generationError(error: unknown, fallback: string) {
  if (error instanceof StudioError) return error;
  if (typeof error === 'object' && error && 'code' in error && error.code === 'moderation_blocked') {
    return new StudioError(
      'invalid_input',
      'This image request did not meet safety requirements. Revise the prompt and try again.',
      400,
    );
  }
  return new StudioError('dependency_failed', fallback, 502);
}

function requireDraft(episode: EpisodeRecord) {
  if (episode.status !== 'draft') {
    throw new StudioError(
      'invalid_input',
      'Published episodes are read-only. Return the episode to draft before generating new assets.',
      409,
    );
  }
}

export function createGenerationDependencies(
  context: StudioContext,
  openaiKey = process.env.OPENAI_API_KEY,
): GenerationDependencies {
  if (!openaiKey) {
    throw new StudioError('dependency_failed', 'OpenAI generation is not configured.', 503);
  }
  const openai = new OpenAI({ apiKey: openaiKey });
  const episodes = createEpisodeServiceForContext(context);

  return {
    getEpisode: episodes.getEpisode,
    attachNarration: episodes.attachNarration,
    attachThumbnail: episodes.attachThumbnail,

    async synthesizeSpeech(input) {
      const response = await openai.audio.speech.create(input);
      return Buffer.from(await response.arrayBuffer());
    },

    async createImage(prompt) {
      const response = await openai.images.generate({
        model: 'gpt-image-2',
        prompt,
        quality: 'low',
        size: '1024x1024',
      });
      const base64 = response.data?.[0]?.b64_json;
      if (!base64) throw new Error('OpenAI returned no image data.');
      return Buffer.from(base64, 'base64');
    },

    async upload(bucket, path, body, contentType) {
      const { error } = await context.supabase.storage
        .from(bucket)
        .upload(path, body, { contentType, upsert: false });
      if (error) throw error;
    },

    async remove(bucket, paths) {
      if (!paths.length) return;
      const { error } = await context.supabase.storage.from(bucket).remove(paths);
      if (error) throw error;
    },

    makeId: () => crypto.randomUUID(),
  };
}

export async function generateNarration(
  context: StudioContext,
  episodeId: string,
  providedDependencies?: GenerationDependencies,
) {
  const dependencies = providedDependencies ?? createGenerationDependencies(context);
  const uploadedPaths: string[] = [];

  try {
    const episode = await dependencies.getEpisode(episodeId);
    requireDraft(episode);
    if (!episode.script.trim()) {
      throw new StudioError('invalid_input', 'Write the episode script before generating narration.', 400);
    }
    if (!episode.voice) {
      throw new StudioError('invalid_input', 'Select a narration voice before generating narration.', 400);
    }
    const chunks = splitForSpeech(episode.script);
    const prefix = `${context.user.id}/${episode.id}/${dependencies.makeId()}`;

    for (const [index, input] of chunks.entries()) {
      const audio = await dependencies.synthesizeSpeech({
        model: 'gpt-4o-mini-tts',
        voice: episode.voice as OpenAiVoice,
        input,
        response_format: 'mp3',
      });
      const path = `${prefix}/narration-${index + 1}.mp3`;
      await dependencies.upload('episode-audio', path, audio, 'audio/mpeg');
      uploadedPaths.push(path);
    }

    await dependencies.attachNarration(episode.id, uploadedPaths);
    return uploadedPaths;
  } catch (error) {
    if (uploadedPaths.length) {
      try {
        await dependencies.remove('episode-audio', uploadedPaths);
      } catch {
        // Cleanup is best-effort; the failed attempt remains private and unattached.
      }
    }
    throw generationError(error, 'Narration generation failed. Please try again.');
  }
}

export async function generateThumbnail(
  context: StudioContext,
  episodeId: string,
  prompt: string,
  providedDependencies?: GenerationDependencies,
) {
  const dependencies = providedDependencies ?? createGenerationDependencies(context);
  let uploadedPath: string | null = null;

  try {
    const episode = await dependencies.getEpisode(episodeId);
    requireDraft(episode);
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      throw new StudioError('invalid_input', 'Write a thumbnail prompt before generating art.', 400);
    }
    const image = await dependencies.createImage(cleanPrompt);
    uploadedPath = `${context.user.id}/${episode.id}/${dependencies.makeId()}/thumbnail.png`;
    await dependencies.upload('episode-images', uploadedPath, image, 'image/png');
    await dependencies.attachThumbnail(episode.id, cleanPrompt, uploadedPath);
    return uploadedPath;
  } catch (error) {
    if (uploadedPath) {
      try {
        await dependencies.remove('episode-images', [uploadedPath]);
      } catch {
        // Cleanup is best-effort; the failed attempt remains private and unattached.
      }
    }
    throw generationError(error, 'Thumbnail generation failed. Please try again.');
  }
}
