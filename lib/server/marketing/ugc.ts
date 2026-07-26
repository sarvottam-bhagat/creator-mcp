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

function promptForHook(hook: typeof BEGGAR_HUSBAND_HOOKS[number]) {
  const creator = hook.presenter === 'female' ? 'Indian female creator' : 'Indian male creator';
  return `Vertical 9:16 social-media UGC talking-head video, exactly 4 seconds. A warm, authentic ${creator} in their twenties records a casual smartphone-style recommendation in a softly lit home studio. Natural eye contact with the camera, expressive but believable delivery, clear English speech and accurate lip sync. Speak this line exactly: "${hook.script}". No music, no subtitles, no on-screen text, no logos, no cuts.`;
}

async function openRouterJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({})) as OpenRouterJob;
  if (!response.ok) throw new Error(payload.error || 'OpenRouter video request failed.');
  return payload;
}

async function submitVideo(hook: typeof BEGGAR_HUSBAND_HOOKS[number]) {
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
    .select('id, creator_id, title, hook_script, presenter, duration_seconds, provider_model, provider_job_id, status, video_path, failure_reason, created_at')
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

async function syncVideo(context: StudioContext, video: UgcVideo) {
  if (video.status !== 'generating' || !video.provider_job_id) return video;
  const job = await openRouterJson(`${OPENROUTER_URL}/${video.provider_job_id}`, { headers: requestHeaders() });
  if (job.status === 'failed') {
    const { data } = await context.supabase
      .from('marketing_ugc_videos')
      .update({ status: 'failed', failure_reason: job.error || 'Video generation failed.' })
      .eq('id', video.id)
      .select('id, creator_id, title, hook_script, presenter, duration_seconds, provider_model, provider_job_id, status, video_path, failure_reason, created_at')
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
    .select('id, creator_id, title, hook_script, presenter, duration_seconds, provider_model, provider_job_id, status, video_path, failure_reason, created_at')
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
