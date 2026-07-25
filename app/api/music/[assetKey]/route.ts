import { readFile } from 'node:fs/promises';
import path from 'node:path';

const tracks: Record<string, string> = {
  'a-tales': 'A-Tales-Background-No-Copyright-Music-01-A-Tales-Background-FULL-TRACK.mp3',
  'in-the-distance': 'In-The-Distance-No-Copyright-Music.com-01-In-The-Distance.mp3',
  'cinematic-piano': 'Storytelling-Essentials-Free-No-Copyright-Music-by-Liborio-Conti-01-Cinematic-Piano.mp3',
  'mallet-scape': 'Storytelling-Essentials-Free-No-Copyright-Music-by-Liborio-Conti-02-Mallet-Scape.mp3',
  'slow-cinematic-piano': 'Storytelling-Essentials-Free-No-Copyright-Music-by-Liborio-Conti-03-Slow-Cinematic-Piano.mp3',
  'serious-scape': 'Storytelling-Essentials-Free-No-Copyright-Music-by-Liborio-Conti-14-A-Little-Serious-Scape.mp3',
  celeste: 'Storytelling-Essentials-Free-No-Copyright-Music-by-Liborio-Conti-18-Celeste.mp3',
};

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ assetKey: string }> }) {
  const { assetKey } = await params;
  const filename = tracks[assetKey];
  if (!filename) return new Response('Music track not found.', { status: 404 });

  try {
    const file = await readFile(path.join(process.cwd(), 'music', filename));
    return new Response(file, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Music track is unavailable.', { status: 404 });
  }
}
