import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function splitForSpeech(script: string) {
  const words = script.trim().split(/\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 3900 && current) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function unauthorized() {
  return Response.json({ error: 'Sign in before generating assets.' }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseKey || !process.env.OPENAI_API_KEY) {
      return Response.json({ error: 'Studio generation is not configured.' }, { status: 503 });
    }

    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return unauthorized();

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return unauthorized();

    const body = await request.json();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prefix = `${userData.user.id}/${crypto.randomUUID()}`;

    if (body.kind === 'narration') {
      if (typeof body.script !== 'string' || !body.script.trim() || typeof body.voice !== 'string') {
        return Response.json({ error: 'A script and voice are required.' }, { status: 400 });
      }
      const paths: string[] = [];
      for (const [index, input] of splitForSpeech(body.script).entries()) {
        const speech = await openai.audio.speech.create({
          model: 'gpt-4o-mini-tts',
          voice: body.voice,
          input,
          response_format: 'mp3',
        });
        const path = `${prefix}/narration-${index + 1}.mp3`;
        const { error } = await supabase.storage
          .from('episode-audio')
          .upload(path, Buffer.from(await speech.arrayBuffer()), { contentType: 'audio/mpeg', upsert: true });
        if (error) throw error;
        paths.push(path);
      }
      return Response.json({ paths });
    }

    if (body.kind === 'thumbnail') {
      if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
        return Response.json({ error: 'A thumbnail prompt is required.' }, { status: 400 });
      }
      const image = await openai.images.generate({
        model: 'gpt-image-2',
        prompt: body.prompt,
        size: '1024x1024',
        quality: 'low',
      });
      const b64 = image.data?.[0]?.b64_json;
      if (!b64) throw new Error('Image generation returned no image.');
      const path = `${prefix}/thumbnail.png`;
      const { error } = await supabase.storage
        .from('episode-images')
        .upload(path, Buffer.from(b64, 'base64'), { contentType: 'image/png', upsert: true });
      if (error) throw error;
      return Response.json({ path });
    }

    return Response.json({ error: 'Unknown generation type.' }, { status: 400 });
  } catch (error) {
    console.error('Studio generation failed', error);
    return Response.json({ error: 'Generation failed. Please try again.' }, { status: 500 });
  }
}
