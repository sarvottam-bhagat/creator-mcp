import OpenAI from 'openai';

import type { StudioContext } from '@/lib/server/studio/context';
import { StudioError } from '@/lib/server/studio/errors';
import { BEGGAR_HUSBAND_HOOKS, type UgcStatus, type UgcVideo } from '@/lib/marketing/ugc';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/videos';
export const SEEDANCE_MODEL = 'bytedance/seedance-2.0-fast';

type OpenRouterJob = {
  id?: string;
  status?: string;
  error?: string;
};

type EpisodeHook = {
  title: string;
  script: string;
  presenter: 'female' | 'male';
};

const episodeHookSchema = {
  type: 'object', additionalProperties: false, required: ['hooks'], properties: {
    hooks: {
      type: 'array', minItems: 5, maxItems: 5,
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'script', 'presenter'],
        properties: {
          title: { type: 'string' },
          script: { type: 'string' },
          presenter: { type: 'string', enum: ['female', 'male'] },
        },
      },
    },
  },
} as const;

function requireOpenRouterKey() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new StudioError('dependency_failed', 'Marketing video generation is not configured.', 503);
  return key;
}

function requestHeaders() {
  return {
    Authorization: `Bearer ${requireOpenRouterKey()}`,
    'Content-Type': 'application/json',
  };
}

function promptForHook(hook: EpisodeHook) {
  const creator = hook.presenter === 'female' ? 'Indian female creator' : 'Indian male creator';
  return `Vertical 9:16 social-media UGC talking-head video, exactly 4 seconds. A warm, authentic ${creator} in their twenties records a casual smartphone-style recommendation in a softly lit home studio. Natural eye contact with the camera, expressive but believable delivery, clear English speech and accurate lip sync. Speak this line exactly: "${hook.script}". No music, no subtitles, no on-screen text, no logos, no cuts.`;
}

async function openRouterJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({})) as OpenRouterJob;
  if (!response.ok) throw new Error(payload.error || 'OpenRouter video request failed.');
  return payload;
}

async function submitVideo(hook: EpisodeHook) {
  const job = await openRouterJson(OPENROUTER_URL, {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify({
      model: SEEDANCE_MODEL,
      prompt: promptForHook(hook),
      aspect_ratio: '9:16',
      duration: 4,
      resolution: '480p',
      generate_audio: true,
    }),
  });
  if (!job.id) throw new Error('OpenRouter did not return a video job ID.');
  return job.id;
}

export async function listUgcVideos(context: StudioContext) {
  const { data, error } = await context.supabase
    .from('marketing_ugc_videos')
    .select('id, creator_id, episode_id, title, hook_script, presenter, duration_seconds, provider_model, provider_job_id, status, video_path, failure_reason, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new StudioError('dependency_failed', 'EchoFM could not load your marketing videos.', 502);
  return (data ?? []) as UgcVideo[];
}

export async function createBeggarHusbandUgcBatch(context: StudioContext) {
  const existing = await listUgcVideos(context);
  if (existing.length) return existing;

  const { data: rows, error } = await context.supabase
    .from('marketing_ugc_videos')
    .insert(BEGGAR_HUSBAND_HOOKS.map((hook) => ({
      creator_id: context.user.id,
      title: hook.title,
      hook_script: hook.script,
      presenter: hook.presenter,
      duration_seconds: 4,
      provider_model: SEEDANCE_MODEL,
      status: 'queued',
    })))
    .select('id, creator_id, title, hook_script, presenter, duration_seconds, provider_model, provider_job_id, status, video_path, failure_reason, created_at');
  if (error || !rows) throw new StudioError('dependency_failed', 'EchoFM could not create your marketing video jobs.', 502);

  await Promise.all(rows.map(async (row, index) => {
    try {
      const providerJobId = await submitVideo(BEGGAR_HUSBAND_HOOKS[index]);
      await context.supabase.from('marketing_ugc_videos')
        .update({ provider_job_id: providerJobId, status: 'generating', failure_reason: null })
        .eq('id', row.id);
    } catch (cause) {
      await context.supabase.from('marketing_ugc_videos')
        .update({ status: 'failed', failure_reason: cause instanceof Error ? cause.message : 'Video submission failed.' })
        .eq('id', row.id);
    }
  }));

  return listUgcVideos(context);
}

async function generateEpisodeHooks(episode: { title: string; script: string; series: { title: string } | null }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new StudioError('dependency_failed', 'Episode-specific hook writing is not configured.', 503);
  try {
    const response = await new OpenAI({ apiKey }).responses.create({
      model: 'gpt-4o-mini',
      instructions: 'You are EchoFM\'s performance-marketing creative director. Create five distinct, natural English talking-head UGC hooks for the supplied audio episode. Each will be spoken in exactly about four seconds. Use an irresistible curiosity gap grounded in the actual episode, never invent a twist, never spoil the ending, never claim the creator personally experienced the story, and never use misleading clickbait. Mix female and male presenters. Return JSON only.',
      input: `Series: ${episode.series?.title ?? 'EchoFM Original'}\nEpisode: ${episode.title}\n\nEpisode script:\n${episode.script.slice(0, 12000)}`,
      text: { format: { type: 'json_schema', name: 'episode_ugc_hooks', strict: true, schema: episodeHookSchema } },
    });
    if (!response.output_text) throw new Error('OpenAI returned no hooks.');
    const parsed = JSON.parse(response.output_text) as { hooks: EpisodeHook[] };
    if (parsed.hooks.length !== 5 || parsed.hooks.some((hook) => !hook.title.trim() || !hook.script.trim())) throw new Error('OpenAI returned invalid hooks.');
    return parsed.hooks.map((hook) => ({
      title: hook.title.trim().slice(0, 80),
      script: hook.script.trim().slice(0, 260),
      presenter: hook.presenter,
    }));
  } catch (error) {
    if (error instanceof StudioError) throw error;
    throw new StudioError('dependency_failed', 'EchoFM could not write episode-specific hooks. Please try again.', 502);
  }
}

export async function createEpisodeUgcBatch(context: StudioContext, episodeId: string) {
  const { data: episode, error: episodeError } = await context.supabase
    .from('episodes')
    .select('id, title, script, status, narration_paths, series:series_id(title)')
    .eq('id', episodeId)
    .single();
  if (episodeError || !episode) throw new StudioError('not_found', 'That episode is not available in your studio.', 404);
  if (episode.status !== 'published' || !episode.script.trim() || !episode.narration_paths.length) {
    throw new StudioError('not_ready', 'Choose a published episode with a script and narration before generating hooks.', 400);
  }
  const existing = await listUgcVideos(context);
  const episodeVideos = existing.filter((video) => video.episode_id === episodeId);
  if (episodeVideos.length) return episodeVideos;
  const rawSeries = episode.series as unknown;
  const series = Array.isArray(rawSeries) ? rawSeries[0] ?? null : rawSeries;
  const hooks = await generateEpisodeHooks({
    title: episode.title,
    script: episode.script,
    series: series as { title: string } | null,
  });
  const { data: rows, error } = await context.supabase
    .from('marketing_ugc_videos')
    .insert(hooks.map((hook) => ({
      creator_id: context.user.id,
      episode_id: episodeId,
      title: hook.title,
      hook_script: hook.script,
      presenter: hook.presenter,
      duration_seconds: 4,
      provider_model: SEEDANCE_MODEL,
      status: 'queued',
    })))
    .select('id, creator_id, episode_id, title, hook_script, presenter, duration_seconds, provider_model, provider_job_id, status, video_path, failure_reason, created_at');
  if (error || !rows) throw new StudioError('dependency_failed', 'EchoFM could not create the episode hook jobs.', 502);
  await Promise.all(rows.map(async (row, index) => {
    try {
      const providerJobId = await submitVideo(hooks[index]);
      await context.supabase.from('marketing_ugc_videos').update({ provider_job_id: providerJobId, status: 'generating', failure_reason: null }).eq('id', row.id);
    } catch (cause) {
      await context.supabase.from('marketing_ugc_videos').update({ status: 'failed', failure_reason: cause instanceof Error ? cause.message : 'Video submission failed.' }).eq('id', row.id);
    }
  }));
  return listUgcVideos(context);
}

async function syncVideo(context: StudioContext, video: UgcVideo) {
  if (video.status !== 'generating' || !video.provider_job_id) return video;
  const job = await openRouterJson(`${OPENROUTER_URL}/${video.provider_job_id}`, { headers: requestHeaders() });
  if (job.status === 'failed') {
    const { data } = await context.supabase
      .from('marketing_ugc_videos')
      .update({ status: 'failed', failure_reason: job.error || 'Video generation failed.' })
      .eq('id', video.id)
      .select('id, creator_id, episode_id, title, hook_script, presenter, duration_seconds, provider_model, provider_job_id, status, video_path, failure_reason, created_at')
      .single();
    return data as UgcVideo;
  }
  if (job.status !== 'completed') return video;

  const content = await fetch(`${OPENROUTER_URL}/${video.provider_job_id}/content`, { headers: requestHeaders() });
  if (!content.ok) throw new Error('OpenRouter could not deliver the completed video.');
  const path = `${context.user.id}/ugc/${video.id}.mp4`;
  const { error: uploadError } = await context.supabase.storage
    .from('marketing-videos')
    .upload(path, await content.blob(), { contentType: 'video/mp4', upsert: true });
  if (uploadError) throw new Error('EchoFM could not save the completed marketing video.');

  const { data, error } = await context.supabase
    .from('marketing_ugc_videos')
    .update({ status: 'completed', video_path: path, failure_reason: null })
    .eq('id', video.id)
    .select('id, creator_id, episode_id, title, hook_script, presenter, duration_seconds, provider_model, provider_job_id, status, video_path, failure_reason, created_at')
    .single();
  if (error || !data) throw new Error('EchoFM could not finalize the marketing video.');
  return data as UgcVideo;
}

export async function refreshUgcVideos(context: StudioContext) {
  const videos = await listUgcVideos(context);
  await Promise.all(videos.map(async (video) => {
    try {
      await syncVideo(context, video);
    } catch (cause) {
      await context.supabase.from('marketing_ugc_videos')
        .update({ status: 'failed', failure_reason: cause instanceof Error ? cause.message : 'Video download failed.' })
        .eq('id', video.id);
    }
  }));
  return listUgcVideos(context);
}
