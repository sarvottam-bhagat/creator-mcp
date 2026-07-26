'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import TopBar from '@/components/TopBar';
import { supabase } from '@/lib/supabase/client';
import { BEGGAR_HUSBAND_HOOKS, type UgcStatus, type UgcVideo } from '@/lib/marketing/ugc';

type MarketingVideo = Pick<UgcVideo, 'id' | 'title' | 'hook_script' | 'presenter' | 'duration_seconds' | 'status' | 'video_path' | 'failure_reason'> & {
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
      const rendering = next.filter((video) => video.status === 'generating' || video.status === 'queued').length;
      setNotice(rendering ? `${rendering} UGC video${rendering === 1 ? '' : 's'} still rendering. This page refreshes automatically.` : next.length ? 'Your finished hooks are private and ready to download.' : 'Your UGC library is ready to create.');
    } catch (error) {
      if (!quiet) setNotice(error instanceof Error ? error.message : 'Marketing videos could not load.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function initialize() {
      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(Boolean(session));
      if (session) await loadVideos();
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
                <div className="aspect-[9/16] bg-fm-surface-2">
                  {video.signedUrl ? (
                    <video className="size-full object-cover" controls playsInline preload="metadata" src={video.signedUrl} />
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
      </main>
    </>
  );
}
