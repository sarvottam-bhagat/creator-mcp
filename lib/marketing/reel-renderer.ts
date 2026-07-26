'use client';

const CORE_VERSION = '0.12.10';
const CORE_BASE_URL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

export type ReelRenderInput = {
  ugcUrl: string;
  narrationUrl: string;
  thumbnailUrl?: string;
  seriesTitle: string;
  episodeTitle: string;
  ctaText: string;
};

async function imageFromUrl(url?: string) {
  if (!url) return null;
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement | null, width: number, height: number) {
  if (!image) return;
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

async function createEndCard(input: Pick<ReelRenderInput, 'thumbnailUrl' | 'seriesTitle' | 'episodeTitle' | 'ctaText'>) {
  const width = 480;
  const height = 854;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('EchoFM could not create the reel end card.');

  drawCover(context, await imageFromUrl(input.thumbnailUrl), width, height);
  const overlay = context.createLinearGradient(0, 0, 0, height);
  overlay.addColorStop(0, 'rgba(8, 8, 10, 0.28)');
  overlay.addColorStop(1, 'rgba(8, 8, 10, 0.94)');
  context.fillStyle = overlay;
  context.fillRect(0, 0, width, height);
  context.textAlign = 'center';
  context.fillStyle = '#ef1525';
  context.font = '600 18px Arial';
  context.fillText('ECHOFM ORIGINAL', width / 2, 278);
  context.fillStyle = '#ffffff';
  context.font = '700 38px Arial';
  context.fillText(input.seriesTitle.slice(0, 32), width / 2, 340);
  context.font = '600 24px Arial';
  context.fillText(input.episodeTitle.slice(0, 42), width / 2, 385);
  context.fillStyle = '#ef1525';
  context.roundRect(122, 465, 236, 58, 29);
  context.fill();
  context.fillStyle = '#ffffff';
  context.font = '700 21px Arial';
  context.fillText(input.ctaText.slice(0, 48), width / 2, 501);
  return new Blob([await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('End card creation failed.')), 'image/png'))], { type: 'image/png' });
}

async function createEpisodeVisual(thumbnailUrl?: string) {
  const width = 480;
  const height = 854;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('EchoFM could not create the episode visual.');
  context.fillStyle = '#121212';
  context.fillRect(0, 0, width, height);
  drawCover(context, await imageFromUrl(thumbnailUrl), width, height);
  const overlay = context.createLinearGradient(0, 0, 0, height);
  overlay.addColorStop(0, 'rgba(8, 8, 10, 0.12)');
  overlay.addColorStop(1, 'rgba(8, 8, 10, 0.5)');
  context.fillStyle = overlay;
  context.fillRect(0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Episode visual creation failed.')), 'image/png'));
}

async function fetchAsset(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('EchoFM could not download one of the selected reel assets.');
  return new Uint8Array(await response.arrayBuffer());
}

export async function renderReel(input: ReelRenderInput, onProgress: (message: string) => void) {
  onProgress('Loading the secure video renderer…');
  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/util'),
  ]);
  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  try {
    onProgress('Preparing your hook, episode preview, and end card…');
    const [ugc, narration, endCard, episodeVisual] = await Promise.all([
      fetchAsset(input.ugcUrl),
      fetchAsset(input.narrationUrl),
      createEndCard(input),
      createEpisodeVisual(input.thumbnailUrl),
    ]);
    await Promise.all([
      ffmpeg.writeFile('hook-source.mp4', ugc),
      ffmpeg.writeFile('narration.mp3', narration),
      ffmpeg.writeFile('end-card.png', new Uint8Array(await endCard.arrayBuffer())),
      ffmpeg.writeFile('episode-visual.png', new Uint8Array(await episodeVisual.arrayBuffer())),
    ]);

    onProgress('Formatting the UGC hook…');
    await ffmpeg.exec(['-i', 'hook-source.mp4', '-t', '4', '-vf', 'scale=480:854:force_original_aspect_ratio=decrease,pad=480:854:(ow-iw)/2:(oh-ih)/2,setsar=1', '-r', '30', '-c:v', 'libx264', '-c:a', 'aac', '-ar', '44100', 'hook.mp4']);
    onProgress('Creating the 20-second episode preview…');
    await ffmpeg.exec(['-loop', '1', '-framerate', '30', '-i', 'episode-visual.png', '-i', 'narration.mp3', '-t', '20', '-shortest', '-c:v', 'libx264', '-c:a', 'aac', '-ar', '44100', 'episode.mp4']);
    onProgress('Adding your EchoFM end card…');
    await ffmpeg.exec(['-loop', '1', '-framerate', '30', '-i', 'end-card.png', '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', '-t', '2', '-shortest', '-c:v', 'libx264', '-c:a', 'aac', '-ar', '44100', 'end.mp4']);
    onProgress('Joining the reel…');
    await ffmpeg.exec(['-i', 'hook.mp4', '-i', 'episode.mp4', '-i', 'end.mp4', '-filter_complex', '[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[v][a]', '-map', '[v]', '-map', '[a]', '-movflags', '+faststart', 'echofm-reel.mp4']);
    const output = await ffmpeg.readFile('echofm-reel.mp4');
    if (typeof output === 'string') throw new Error('The reel output was invalid.');
    const copy = new Uint8Array(output.byteLength);
    copy.set(output);
    return new Blob([copy.buffer], { type: 'video/mp4' });
  } finally {
    ffmpeg.terminate();
  }
}
