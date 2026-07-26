'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import TopBar from '@/components/TopBar';
import { renderReel } from '@/lib/marketing/reel-renderer';
import { supabase } from '@/lib/supabase/client';
import { BEGGAR_HUSBAND_HOOKS, type UgcStatus, type UgcVideo } from '@/lib/marketing/ugc';

type MarketingVideo = Pick<UgcVideo, 'id' | 'title' | 'hook_script' | 'presenter' | 'duration_seconds' | 'status' | 'video_path' | 'failure_reason'> & {
  signedUrl?: string;
};
type PublishedEpisode = {
  id: string;
  title: string;
  narration_paths: string[];
  thumbnail_path: string | null;
  series: { title: string } | null;
};
type MarketingReel = {
  id: string;
  cta_text: string;
  duration_seconds: number;
  video_path: string | null;
  created_at: string;
  episodes: { title: string; series: { title: string } | null } | null;
  signedUrl?: string;
};

const statusStyle: Record<UgcStatus, string> = {
  queued: 'text-amber-300 border-amber-300/30 bg-amber-300/10',
  generating: 'text-violet-300 border-violet-300/30 bg-violet-300/10',
  completed: 'text-emerald-300 border-emerald-300/30 bg-emerald-300/10',
  failed: 'text-fm-red border-fm-red/30 bg-fm-red/10',
};

function statusLabel(status: UgcStatus) {
  if (status === 'generating') return 'Rendering';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function MarketingPage() {
  const [videos, setVideos] = useState<MarketingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState('Sign in to build your private UGC video library.');
  const [hasSession, setHasSession] = useState(false);
  const [episodes, setEpisodes] = useState<PublishedEpisode[]>([]);
  const [reels, setReels] = useState<MarketingReel[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState('');
  const [selectedUgcId, setSelectedUgcId] = useState('');
  const [ctaText, setCtaText] = useState('Listen now on EchoFM');
  const [renderingReel, setRenderingReel] = useState(false);
  const [reelProgress, setReelProgress] = useState('');

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sign in from your Profile to use Marketing.');
    return { Authorization: `Bearer ${session.access_token}` };
  }

  async function addPreviewUrls(items: MarketingVideo[]) {
    return Promise.all(items.map(async (video) => {
      if (!video.video_path) return video;
      const { data } = await supabase.storage.from('marketing-videos').createSignedUrl(video.video_path, 60 * 60);
      return { ...video, signedUrl: data?.signedUrl };
    }));
  }

  async function loadVideos({ quiet = false } = {}) {
    try {
      const headers = await authHeaders();
      const response = await fetch('/api/marketing/ugc', { headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const next = await addPreviewUrls(data.videos as MarketingVideo[]);
      setVideos(next);
      const completed = next.filter((video) => video.status === 'completed' && video.signedUrl);
      setSelectedUgcId((current) => current || completed[0]?.id || '');
      const rendering = next.filter((video) => video.status === 'generating' || video.status === 'queued').length;
      setNotice(rendering ? `${rendering} UGC video${rendering === 1 ? '' : 's'} still rendering. This page refreshes automatically.` : next.length ? 'Your finished hooks are private and ready to download.' : 'Your UGC library is ready to create.');
    } catch (error) {
      if (!quiet) setNotice(error instanceof Error ? error.message : 'Marketing videos could not load.');
    } finally {
      setLoading(false);
    }
  }

  async function loadReelMakerAssets() {
    const [{ data: episodeRows, error: episodeError }, { data: reelRows, error: reelError }] = await Promise.all([
      supabase
        .from('episodes')
        .select('id, title, narration_paths, thumbnail_path, series:series_id(title)')
        .eq('status', 'published')
        .order('published_at', { ascending: false }),
      supabase
        .from('marketing_reels')
        .select('id, cta_text, duration_seconds, video_path, created_at, episodes(title, series(title))')
        .order('created_at', { ascending: false }),
    ]);
    if (!episodeError) {
      const nextEpisodes = ((episodeRows ?? []) as unknown as PublishedEpisode[]).filter((episode) => episode.narration_paths.length > 0);
      setEpisodes(nextEpisodes);
      setSelectedEpisodeId((current) => current || nextEpisodes[0]?.id || '');
    }
    if (!reelError) {
      const nextReels = await Promise.all(((reelRows ?? []) as unknown as MarketingReel[]).map(async (reel) => {
        if (!reel.video_path) return reel;
        const { data } = await supabase.storage.from('marketing-videos').createSignedUrl(reel.video_path, 60 * 60);
        return { ...reel, signedUrl: data?.signedUrl };
      }));
      setReels(nextReels);
    }
  }

  useEffect(() => {
    async function initialize() {
      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(Boolean(session));
      if (session) {
        await Promise.all([loadVideos(), loadReelMakerAssets()]);
      }
      else setLoading(false);
    }
    void initialize();
  }, []);

  useEffect(() => {
    if (!videos.some((video) => video.status === 'generating' || video.status === 'queued')) return;
    const interval = window.setInterval(() => { void loadVideos({ quiet: true }); }, 12_000);
    return () => window.clearInterval(interval);
  }, [videos]);

  async function generateHooks() {
    setGenerating(true);
    try {
      const response = await fetch('/api/marketing/ugc', { method: 'POST', headers: await authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const next = await addPreviewUrls(data.videos as MarketingVideo[]);
      setVideos(next);
      setNotice(data.alreadyCreated ? 'This five-video hook pack already exists in your library.' : 'Five Seedance UGC jobs were submitted. Videos will appear here as each one finishes.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The UGC videos could not be submitted.');
    } finally {
      setGenerating(false);
    }
  }

  async function createReel() {
    const episode = episodes.find((item) => item.id === selectedEpisodeId);
    const ugc = videos.find((item) => item.id === selectedUgcId);
    if (!episode || !ugc?.signedUrl) {
      setNotice('Choose a published episode and a completed UGC hook first.');
      return;
    }
    if (!episode.narration_paths[0]) {
      setNotice('This episode needs generated narration before it can become a reel.');
      return;
    }
    setRenderingReel(true);
    try {
      setReelProgress('Preparing your private reel…');
      const [{ data: audio }, { data: image }] = await Promise.all([
        supabase.storage.from('episode-audio').createSignedUrl(episode.narration_paths[0], 60 * 60),
        episode.thumbnail_path ? supabase.storage.from('episode-images').createSignedUrl(episode.thumbnail_path, 60 * 60) : Promise.resolve({ data: null }),
      ]);
      if (!audio?.signedUrl) throw new Error('EchoFM could not load this episode narration.');
      const reel = await renderReel({
        ugcUrl: ugc.signedUrl,
        narrationUrl: audio.signedUrl,
        thumbnailUrl: image?.signedUrl,
        seriesTitle: episode.series?.title ?? 'EchoFM Original',
        episodeTitle: episode.title,
        ctaText: ctaText.trim() || 'Listen now on EchoFM',
      }, setReelProgress);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in before saving the reel.');
      const { data: saved, error: saveError } = await supabase
        .from('marketing_reels')
        .insert({ creator_id: user.id, episode_id: episode.id, ugc_video_id: ugc.id, cta_text: ctaText.trim() || 'Listen now on EchoFM', duration_seconds: 26 })
        .select('id')
        .single();
      if (saveError || !saved) throw saveError ?? new Error('EchoFM could not save this reel.');
      const path = `${user.id}/reels/${saved.id}.mp4`;
      const { error: uploadError } = await supabase.storage.from('marketing-videos').upload(path, reel, { contentType: 'video/mp4', upsert: false });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.from('marketing_reels').update({ video_path: path }).eq('id', saved.id);
      if (updateError) throw updateError;
      const downloadUrl = URL.createObjectURL(reel);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${episode.series?.title ?? 'echofm'}-${episode.title}-reel.mp4`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      link.click();
      URL.revokeObjectURL(downloadUrl);
      setNotice('Your reel is complete, saved privately, and downloading now.');
      await loadReelMakerAssets();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The reel could not be created. Please try again.');
    } finally {
      setRenderingReel(false);
      setReelProgress('');
    }
  }

  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-6xl px-6 pt-8 pb-20 sm:px-10">
        <Link href="/studio" className="text-xs text-fm-tertiary transition-colors hover:text-fm-primary">← Back to Studio</Link>
        <section className="mt-6 flex flex-col gap-6 border-b border-fm-divider pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-fm-red uppercase">EchoFM Marketing</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-fm-primary">UGC Hook Library</h1>
            <p className="mt-2 max-w-2xl text-fm-tertiary">Create creator-style talking-head hooks now. You can attach the best one to an episode when Reel Maker arrives.</p>
          </div>
          {hasSession && (
            <button
              type="button"
              onClick={() => void generateHooks()}
              disabled={generating || videos.length > 0}
              className="rounded-full bg-fm-red px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {generating ? 'Submitting 5 videos…' : videos.length ? 'Hook pack created' : 'Create 5 UGC hooks'}
            </button>
          )}
        </section>

        <div className="mt-5 rounded-xl border border-fm-border bg-fm-surface px-5 py-4 text-sm text-fm-secondary">{notice}</div>

        {hasSession && videos.some((video) => video.status === 'completed' && video.signedUrl) && (
          <section className="mt-8 rounded-2xl border border-fm-border bg-fm-surface p-6 sm:p-8">
            <p className="text-xs font-semibold tracking-[0.18em] text-fm-red uppercase">Reel Maker</p>
            <h2 className="mt-2 text-2xl font-semibold text-fm-primary">Turn a hook into an episode reel</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-fm-tertiary">EchoFM joins the selected UGC hook, the first 20 seconds of your episode narration with its cover visual, and a two-second CTA end card. Rendering happens privately in this browser and the final MP4 is saved to your library.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-fm-secondary">
                Published episode
                <select value={selectedEpisodeId} onChange={(event) => setSelectedEpisodeId(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-fm-border bg-black px-3 text-sm text-fm-primary focus:border-fm-border-bright focus:outline-none">
                  {episodes.length ? episodes.map((episode) => <option key={episode.id} value={episode.id}>{episode.series?.title ?? 'Untitled series'} — {episode.title}</option>) : <option value="">No published narrated episodes yet</option>}
                </select>
              </label>
              <label className="text-sm font-medium text-fm-secondary">
                Talking UGC hook
                <select value={selectedUgcId} onChange={(event) => setSelectedUgcId(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-fm-border bg-black px-3 text-sm text-fm-primary focus:border-fm-border-bright focus:outline-none">
                  {videos.filter((video) => video.status === 'completed' && video.signedUrl).map((video) => <option key={video.id} value={video.id}>{video.presenter} — {video.title}</option>)}
                </select>
              </label>
            </div>
            <label className="mt-4 block text-sm font-medium text-fm-secondary">
              Final CTA text
              <input value={ctaText} maxLength={120} onChange={(event) => setCtaText(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-fm-border bg-black px-3 text-sm text-fm-primary focus:border-fm-border-bright focus:outline-none" />
            </label>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <button type="button" onClick={() => void createReel()} disabled={renderingReel || !selectedEpisodeId || !selectedUgcId} className="rounded-full bg-fm-red px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45">
                {renderingReel ? 'Rendering your reel…' : 'Create 26-second reel'}
              </button>
              <span className="text-sm text-fm-tertiary">{reelProgress || '4 sec hook + 20 sec episode + 2 sec end card'}</span>
            </div>
          </section>
        )}

        {!hasSession && !loading && (
          <div className="mt-8 rounded-2xl border border-fm-border bg-fm-surface p-8">
            <h2 className="text-xl font-semibold">Sign in to create private marketing videos</h2>
            <p className="mt-2 text-fm-tertiary">Your generated video hooks are saved only to your EchoFM account.</p>
            <Link href="/profile" className="mt-5 inline-flex rounded-full bg-fm-red px-5 py-3 text-sm font-semibold text-white">Open Profile</Link>
          </div>
        )}

        {hasSession && !videos.length && !loading && (
          <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {BEGGAR_HUSBAND_HOOKS.map((hook) => (
              <article key={hook.title} className="rounded-2xl border border-fm-border bg-fm-surface p-5">
                <p className="text-xs font-semibold tracking-[0.14em] text-fm-red uppercase">{hook.presenter} UGC · 4 sec</p>
                <h2 className="mt-3 text-lg font-semibold">{hook.title}</h2>
                <p className="mt-2 text-sm leading-6 text-fm-secondary">“{hook.script}”</p>
              </article>
            ))}
          </section>
        )}

        {!!videos.length && (
          <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {videos.map((video) => (
              <article key={video.id} className="overflow-hidden rounded-2xl border border-fm-border bg-fm-surface">
                <div className="relative aspect-[9/16] bg-fm-surface-2">
                  {video.signedUrl ? (
                    <>
                      <video
                        className="size-full object-cover"
                        autoPlay
                        muted
                        loop
                        controls
                        playsInline
                        preload="metadata"
                        src={video.signedUrl}
                      />
                      <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">
                        Playing muted
                      </span>
                    </>
                  ) : (
                    <div className="flex size-full items-center justify-center px-6 text-center text-sm text-fm-tertiary">
                      {video.status === 'failed' ? video.failure_reason : 'Your private UGC video will appear here when rendering finishes.'}
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-fm-tertiary">{video.presenter} creator · {video.duration_seconds} sec</p>
                      <h2 className="mt-1 font-semibold text-fm-primary">{video.title}</h2>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle[video.status]}`}>{statusLabel(video.status)}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-fm-secondary">“{video.hook_script}”</p>
                  {video.signedUrl && <a className="mt-4 inline-flex rounded-full border border-fm-border px-4 py-2 text-sm font-semibold text-fm-primary hover:border-fm-border-bright" href={`${video.signedUrl}&download=${encodeURIComponent(`${video.title}.mp4`)}`}>Download MP4</a>}
                </div>
              </article>
            ))}
          </section>
        )}

        {!!reels.length && (
          <section className="mt-10 border-t border-fm-divider pt-8">
            <p className="text-xs font-semibold tracking-[0.18em] text-fm-red uppercase">Your reel library</p>
            <h2 className="mt-2 text-2xl font-semibold">Saved marketing reels</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {reels.map((reel) => (
                <article key={reel.id} className="overflow-hidden rounded-2xl border border-fm-border bg-fm-surface">
                  {reel.signedUrl && <video className="aspect-[9/16] w-full object-cover" controls playsInline preload="metadata" src={reel.signedUrl} />}
                  <div className="p-5">
                    <p className="text-xs text-fm-tertiary">{reel.duration_seconds} sec · {new Date(reel.created_at).toLocaleDateString()}</p>
                    <h3 className="mt-1 font-semibold">{reel.episodes?.series?.title ?? 'EchoFM'} — {reel.episodes?.title ?? 'Episode'}</h3>
                    <p className="mt-2 text-sm text-fm-secondary">“{reel.cta_text}”</p>
                    {reel.signedUrl && <a className="mt-4 inline-flex rounded-full border border-fm-border px-4 py-2 text-sm font-semibold hover:border-fm-border-bright" href={`${reel.signedUrl}&download=echofm-reel.mp4`}>Download MP4</a>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
