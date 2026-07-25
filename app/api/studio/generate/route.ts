import { createStudioContext } from '@/lib/server/studio/context';
import { StudioError } from '@/lib/server/studio/errors';
import { generateNarration, generateThumbnail } from '@/lib/server/studio/generation';

export const runtime = 'nodejs';

function unauthorized() {
  return Response.json({ error: 'Sign in before generating assets.' }, { status: 401 });
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey || !process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'Studio generation is not configured.' }, { status: 503 });
  }

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return unauthorized();

  try {
    const context = await createStudioContext(token, { supabaseUrl, supabaseKey });
    const body = await request.json();
    if (typeof body.episodeId !== 'string' || !body.episodeId.trim()) {
      return Response.json({ error: 'A saved episode is required before generation.' }, { status: 400 });
    }

    if (body.kind === 'narration') {
      const paths = await generateNarration(context, body.episodeId);
      return Response.json({ paths });
    }

    if (body.kind === 'thumbnail') {
      if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
        return Response.json({ error: 'A thumbnail prompt is required.' }, { status: 400 });
      }
      const path = await generateThumbnail(context, body.episodeId, body.prompt);
      return Response.json({ path });
    }

    return Response.json({ error: 'Unknown generation type.' }, { status: 400 });
  } catch (error) {
    if (error instanceof StudioError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    const requestId = crypto.randomUUID();
    console.error('Studio generation failed', { requestId });
    return Response.json(
      { error: 'Generation failed. Please try again.', requestId },
      { status: 500 },
    );
  }
}
