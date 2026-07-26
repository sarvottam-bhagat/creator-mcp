import { createStudioContext } from '@/lib/server/studio/context';
import { StudioError } from '@/lib/server/studio/errors';
import { applyCliffhangerRewrite, scoreCliffhanger } from '@/lib/server/studio/cliffhanger';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!supabaseUrl || !supabaseKey) return Response.json({ error: 'Studio is not configured.' }, { status: 503 });
  if (!token) return Response.json({ error: 'Sign in before optimizing an ending.' }, { status: 401 });
  try {
    const body = await request.json();
    if (typeof body.episodeId !== 'string' || !body.episodeId.trim()) return Response.json({ error: 'Save a draft before optimizing its ending.' }, { status: 400 });
    const context = await createStudioContext(token, { supabaseUrl, supabaseKey });
    if (body.action === 'analyze') {
      const analysis = await scoreCliffhanger(context, body.episodeId, { genre: typeof body.genre === 'string' ? body.genre : undefined });
      return Response.json({ analysis });
    }
    if (body.action === 'apply' && typeof body.ending === 'string') {
      const episode = await applyCliffhangerRewrite(context, body.episodeId, body.ending);
      return Response.json({ episode });
    }
    return Response.json({ error: 'Unknown cliffhanger action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof StudioError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    const requestId = crypto.randomUUID();
    console.error('Cliffhanger request failed', { requestId });
    return Response.json({ error: 'Cliffhanger optimization failed. Please try again.', requestId }, { status: 500 });
  }
}
