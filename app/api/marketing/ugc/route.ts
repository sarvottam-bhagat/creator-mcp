import { createStudioContext } from '@/lib/server/studio/context';
import { StudioError } from '@/lib/server/studio/errors';
import { createEpisodeUgcBatch, refreshUgcVideos } from '@/lib/server/marketing/ugc';

export const runtime = 'nodejs';
export const maxDuration = 60;

function configuration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new StudioError('dependency_failed', 'Marketing is not configured.', 503);
  return { supabaseUrl, supabaseKey };
}

async function contextFrom(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new StudioError('unauthorized', 'Sign in before using Marketing.', 401);
  return createStudioContext(token, configuration());
}

function responseError(error: unknown) {
  if (error instanceof StudioError) return Response.json({ error: error.message }, { status: error.status });
  const requestId = crypto.randomUUID();
  console.error('Marketing UGC request failed', { requestId });
  return Response.json({ error: 'Marketing video request failed. Please try again.', requestId }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const context = await contextFrom(request);
    return Response.json({ videos: await refreshUgcVideos(context) });
  } catch (error) {
    return responseError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await contextFrom(request);
    const body = await request.json().catch(() => null) as { episodeId?: unknown } | null;
    if (!body || typeof body.episodeId !== 'string' || !body.episodeId.trim()) {
      throw new StudioError('invalid_input', 'Choose a published episode before generating hooks.', 400);
    }
    return Response.json({ videos: await createEpisodeUgcBatch(context, body.episodeId) }, { status: 202 });
  } catch (error) {
    return responseError(error);
  }
}
