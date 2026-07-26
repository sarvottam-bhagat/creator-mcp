'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import TopBar from '@/components/TopBar';
import { prepareGenerationPayload } from '@/lib/studio/generation-request';
import { getPublishBlockers } from '@/lib/studio/publish';
import { OPENAI_VOICES, type OpenAiVoice } from '@/lib/studio/voices';
import { supabase } from '@/lib/supabase/client';

type MusicTrack = { id: string; title: string; mood: string; duration_seconds: number; asset_key: string };
type PublishedEpisode = {
  id: string;
  title: string;
  voice: string | null;
  narration_paths: string[];
  thumbnail_path: string | null;
  published_at: string | null;
  music_tracks: Pick<MusicTrack, 'title' | 'mood' | 'asset_key'> | null;
};
type DraftEpisode = {
  id: string;
  title: string;
  script: string;
  voice: OpenAiVoice | null;
  music_track_id: string | null;
  narration_paths: string[];
  thumbnail_path: string | null;
  thumbnail_prompt: string;
  updated_at: string;
};
type Step = 'Script' | 'Voice' | 'Music' | 'Thumbnail' | 'Review';
type CliffhangerOption = { id: string; title: string; ending: string; rationale: string };
type CliffhangerAnalysis = { score: number; strengths: string[]; improvements: string[]; next_episode_hook: string; options: CliffhangerOption[] };

const steps: Step[] = ['Script', 'Voice', 'Music', 'Thumbnail', 'Review'];

export default function StudioPage() {
  const [step, setStep] = useState<Step>('Script');
  const [title, setTitle] = useState('');
  const [script, setScript] = useState('');
  const [voice, setVoice] = useState<OpenAiVoice>('marin');
  const [music, setMusic] = useState<MusicTrack[]>([]);
  const [musicTrackId, setMusicTrackId] = useState('night-drive');
  const [thumbnailPrompt, setThumbnailPrompt] = useState('A cinematic midnight city rooftop in rain, a glowing vintage radio on a ledge, deep violet and crimson light, atmospheric audio drama cover art, no text');
  const [thumbnailPath, setThumbnailPath] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [narrationPaths, setNarrationPaths] = useState<string[]>([]);
  const [narrationUrls, setNarrationUrls] = useState<string[]>([]);
  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [notice, setNotice] = useState('Preparing your private creator workspace…');
  const [busy, setBusy] = useState<'narration' | 'thumbnail' | 'save' | 'publish' | 'cliffhanger' | 'rewrite' | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [publishedEpisodes, setPublishedEpisodes] = useState<PublishedEpisode[]>([]);
  const [draftEpisodes, setDraftEpisodes] = useState<DraftEpisode[]>([]);
  const [cliffhanger, setCliffhanger] = useState<CliffhangerAnalysis | null>(null);
  const [selectedCliffhanger, setSelectedCliffhanger] = useState<string | null>(null);

  async function loadPublishedEpisodes() {
    const { data, error } = await supabase
      .from('episodes')
      .select('id, title, voice, narration_paths, thumbnail_path, published_at, music_tracks(title, mood, asset_key)')
      .eq('status', 'published')
      .order('published_at', { ascending: false });
    if (!error) setPublishedEpisodes((data ?? []) as unknown as PublishedEpisode[]);
  }

  async function loadDraftEpisodes() {
    const { data, error } = await supabase
      .from('episodes')
      .select('id, title, script, voice, music_track_id, narration_paths, thumbnail_path, thumbnail_prompt, updated_at')
      .eq('status', 'draft')
      .order('updated_at', { ascending: false });
    if (!error) setDraftEpisodes((data ?? []) as DraftEpisode[]);
  }

  function resetForNewEpisode() {
    setEpisodeId(null);
    setTitle('');
    setScript('');
    setVoice('marin');
    setMusicTrackId('night-drive');
    setNarrationPaths([]);
    setThumbnailPath(null);
    setThumbnailUrl(null);
    setThumbnailPrompt('');
    setCliffhanger(null);
    setSelectedCliffhanger(null);
    setNotice('New episode selected. Write a script, then save or analyze it when ready.');
  }

  function selectDraft(id: string) {
    const draft = draftEpisodes.find((item) => item.id === id);
    if (!draft) return;
    setEpisodeId(draft.id);
    setTitle(draft.title);
    setScript(draft.script);
    setVoice(draft.voice ?? 'marin');
    setMusicTrackId(draft.music_track_id ?? '');
    setNarrationPaths(draft.narration_paths);
    setThumbnailPath(draft.thumbnail_path);
    setThumbnailPrompt(draft.thumbnail_prompt);
    setCliffhanger(null);
    setSelectedCliffhanger(null);
    setNotice(`Editing draft: ${draft.title}.`);
  }

  useEffect(() => {
    async function prepareStudio() {
      let { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          await supabase.auth.signOut();
          session = null;
        }
      }
      if (!session) {
        setHasSession(false);
        setNotice('Sign in from your Profile to create, save, and publish episodes in your private Studio.');
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setHasSession(true);
      const { data: tracks, error: tracksError } = await supabase
        .from('music_tracks')
        .select('id, title, mood, duration_seconds, asset_key')
        .order('title');
      if (tracksError) setNotice('Your workspace is ready, but soundtrack options could not load.');
      else {
        setMusic(tracks ?? []);
        await loadPublishedEpisodes();
        await loadDraftEpisodes();
        setNotice('Private Studio workspace ready. Your work is saved to your account.');
      }
    }
    void prepareStudio();
  }, []);

  useEffect(() => {
    async function loadNarrationPreviews() {
      if (!narrationPaths.length) {
        setNarrationUrls([]);
        return;
      }
      const urls = await Promise.all(narrationPaths.map(async (path) => {
        const { data } = await supabase.storage.from('episode-audio').createSignedUrl(path, 60 * 60);
        return data?.signedUrl;
      }));
      setNarrationUrls(urls.filter((url): url is string => Boolean(url)));
    }
    void loadNarrationPreviews();
  }, [narrationPaths]);

  const blockers = useMemo(
    () => getPublishBlockers({ title, script, voice, musicTrackId, narrationPaths, thumbnailPath }),
    [title, script, voice, musicTrackId, narrationPaths, thumbnailPath],
  );

  async function authHeader() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Please sign in to use Studio.');
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
  }

  async function ensureEpisode(status: 'draft' | 'published') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Please sign in to save an episode.');
    const now = status === 'published' ? new Date().toISOString() : null;
    const payload = { title: title.trim() || 'Untitled episode', script, voice, music_track_id: musicTrackId || null, narration_paths: narrationPaths, thumbnail_path: thumbnailPath, thumbnail_prompt: thumbnailPrompt, status, published_at: now };
    if (episodeId) {
      const { error } = await supabase.from('episodes').update(payload).eq('id', episodeId);
      if (error) throw error;
      return episodeId;
    }
    const { data: series, error: seriesError } = await supabase
      .from('series')
      .insert({ creator_id: user.id, title: 'My EchoFM series' })
      .select('id')
      .single();
    if (seriesError || !series) throw seriesError ?? new Error('Could not create a series.');
    const { data: episode, error: episodeError } = await supabase
      .from('episodes')
      .insert({ ...payload, series_id: series.id })
      .select('id')
      .single();
    if (episodeError || !episode) throw episodeError ?? new Error('Could not create an episode.');
    setEpisodeId(episode.id);
    await loadDraftEpisodes();
    return episode.id;
  }

  async function generateNarration() {
    setBusy('narration');
    try {
      const payload = await prepareGenerationPayload('narration', () => ensureEpisode('draft'));
      const response = await fetch('/api/studio/generate', { method: 'POST', headers: await authHeader(), body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNarrationPaths(data.paths);
      setNotice(`Narration created in ${data.paths.length} audio part${data.paths.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Narration could not be created.');
    } finally { setBusy(null); }
  }

  async function generateThumbnail() {
    setBusy('thumbnail');
    try {
      const payload = await prepareGenerationPayload('thumbnail', () => ensureEpisode('draft'), thumbnailPrompt);
      const response = await fetch('/api/studio/generate', { method: 'POST', headers: await authHeader(), body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setThumbnailPath(data.path);
      const { data: signed, error } = await supabase.storage.from('episode-images').createSignedUrl(data.path, 60 * 60);
      if (error) throw error;
      setThumbnailUrl(signed.signedUrl);
      setNotice('Your thumbnail is ready.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Thumbnail could not be created.');
    } finally { setBusy(null); }
  }

  async function analyzeCliffhanger() {
    setBusy('cliffhanger');
    try {
      const savedEpisodeId = await ensureEpisode('draft');
      const response = await fetch('/api/studio/cliffhanger', { method: 'POST', headers: await authHeader(), body: JSON.stringify({ action: 'analyze', episodeId: savedEpisodeId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCliffhanger(data.analysis);
      setSelectedCliffhanger(data.analysis.options[0]?.id ?? null);
      setNotice(`Cliffhanger scored ${data.analysis.score}/100. Choose an option to update only the ending.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Cliffhanger analysis could not be completed.');
    } finally { setBusy(null); }
  }

  async function applyCliffhanger() {
    const option = cliffhanger?.options.find((item) => item.id === selectedCliffhanger);
    if (!option || !episodeId) return;
    setBusy('rewrite');
    try {
      const response = await fetch('/api/studio/cliffhanger', { method: 'POST', headers: await authHeader(), body: JSON.stringify({ action: 'apply', episodeId, ending: option.ending }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setScript(data.episode.script);
      await loadDraftEpisodes();
      setCliffhanger(null);
      setSelectedCliffhanger(null);
      setNotice('Selected ending saved to your private draft. It has not been published.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The ending could not be updated.');
    } finally { setBusy(null); }
  }

  async function save(status: 'draft' | 'published') {
    if (status === 'published' && blockers.length) {
      setStep('Review');
      setNotice(`Finish ${blockers.join(', ')} before publishing.`);
      return;
    }
    setBusy(status === 'published' ? 'publish' : 'save');
    try {
      await ensureEpisode(status);
      await loadDraftEpisodes();
      if (status === 'published') await loadPublishedEpisodes();
      setNotice(status === 'published' ? 'Episode published — it is ready for your audience.' : 'Draft saved to Studio.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Your changes could not be saved.');
    } finally { setBusy(null); }
  }

  const selectedMusic = music.find((track) => track.id === musicTrackId);
  const selectedVoice = OPENAI_VOICES.find((item) => item.id === voice);

  return (
    <>
      <TopBar userName="Creator" />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
        <div className="mb-8 flex flex-col gap-5 border-b border-fm-divider pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="text-xs text-fm-tertiary transition hover:text-fm-primary">← Back to EchoFM</Link>
            <p className="mt-4 text-xs font-medium tracking-[0.18em] text-fm-red uppercase">EchoFM Studio</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fm-primary sm:text-4xl">Make your next audio episode.</h1>
            <p className="mt-2 max-w-2xl text-sm text-fm-tertiary">Write, narrate, score and package an episode in one private creator workspace.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/studio/connections" className="rounded-full border border-fm-border px-5 py-2.5 text-sm font-medium text-fm-secondary hover:border-fm-border-bright hover:text-fm-primary">Connected agents</Link>
            <button onClick={() => void save('draft')} disabled={busy !== null || !hasSession} className="rounded-full border border-fm-border px-5 py-2.5 text-sm font-medium text-fm-secondary hover:border-fm-border-bright hover:text-fm-primary disabled:opacity-50">{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
          </div>
        </div>

        <ol className="mb-8 grid grid-cols-5 gap-1 rounded-2xl border border-fm-divider bg-fm-surface p-2" aria-label="Episode creation steps">
          {steps.map((item, index) => <li key={item}><button onClick={() => setStep(item)} className={`w-full rounded-xl px-2 py-3 text-left text-xs transition sm:px-3 sm:text-sm ${step === item ? 'bg-fm-elevated text-fm-primary' : 'text-fm-tertiary hover:bg-white/5 hover:text-fm-secondary'}`}><span className="mr-2 text-fm-red">0{index + 1}</span><span className="hidden sm:inline">{item}</span></button></li>)}
        </ol>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-2xl border border-fm-divider bg-fm-surface p-5 sm:p-7">
            {step === 'Script' && <div>
              <StepHeading eyebrow="01 / Script" title="Choose a draft, then write the story." text="The editor and optimizer always work on the episode selected below." />
              <div className="mt-7 rounded-xl border border-fm-border bg-black/10 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><label className="block flex-1 text-sm font-medium text-fm-secondary">Editing episode<select value={episodeId ?? ''} onChange={(event) => event.target.value ? selectDraft(event.target.value) : resetForNewEpisode()} className="mt-2 h-11 w-full rounded-xl border border-fm-border bg-black/20 px-3 text-fm-primary outline-none focus:border-fm-border-bright"><option value="">New untitled episode</option>{draftEpisodes.map((draft) => <option key={draft.id} value={draft.id}>{draft.title || 'Untitled episode'} · last saved {new Date(draft.updated_at).toLocaleDateString()}</option>)}</select></label><button onClick={resetForNewEpisode} className="rounded-full border border-fm-border px-4 py-2.5 text-xs font-semibold text-fm-secondary hover:border-fm-border-bright hover:text-fm-primary">+ New episode</button></div>
                <p className="mt-3 text-xs leading-5 text-fm-tertiary">Published episodes are playback-only. To improve an older published episode, create a new draft from it first.</p>
              </div>
              <label className="mt-7 block text-sm font-medium text-fm-secondary">Episode title<input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-fm-border bg-black/20 px-3 text-fm-primary outline-none focus:border-fm-border-bright" /></label>
              <label className="mt-5 block text-sm font-medium text-fm-secondary">Narration script<textarea value={script} onChange={(event) => setScript(event.target.value)} rows={12} className="mt-2 w-full resize-y rounded-xl border border-fm-border bg-black/20 p-3 leading-7 text-fm-primary outline-none focus:border-fm-border-bright" /></label>
              <p className="mt-2 text-xs text-fm-tertiary">{script.length.toLocaleString()} characters · long scripts are automatically split into narrated parts.</p>
              <div className="mt-6 rounded-xl border border-fm-border bg-black/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-fm-primary">Improve this episode’s ending</p><p className="mt-1 text-xs leading-5 text-fm-tertiary">Analyzes your current writing only when you click the button. This avoids surprise API usage while you type.</p></div><span className="rounded-full border border-fm-border px-3 py-1 text-xs text-fm-secondary">{episodeId ? `Selected: ${title || 'Untitled draft'}` : 'New episode — not saved yet'}</span></div>
                <div className="mt-4 rounded-lg bg-fm-surface-2 p-3 text-xs text-fm-tertiary"><span className="font-semibold text-fm-secondary">How it works:</span> 1. Save selected draft  2. Analyze its current ending  3. Choose a rewrite  4. Get a hook for the next episode.</div>
                <button onClick={() => void analyzeCliffhanger()} disabled={busy !== null || script.trim().length < 40 || !hasSession} className="mt-4 rounded-full border border-fm-border px-4 py-2 text-xs font-semibold text-fm-secondary hover:border-fm-border-bright hover:text-fm-primary disabled:opacity-50">{busy === 'cliffhanger' ? 'Analyzing current writing…' : cliffhanger ? 'Re-analyze current writing' : 'Analyze this ending'}</button>
                {cliffhanger && <div className="mt-4 border-t border-fm-divider pt-4">
                  <p className="text-sm font-medium text-fm-primary">Retention score: <span className="text-fm-red">{cliffhanger.score}/100</span></p>
                  <p className="mt-2 text-xs text-fm-secondary">Next episode opening: {cliffhanger.next_episode_hook}</p>
                  <div className="mt-4 grid gap-3">{cliffhanger.options.map((option) => <label key={option.id} className={`cursor-pointer rounded-xl border p-3 ${selectedCliffhanger === option.id ? 'border-fm-red bg-fm-red/10' : 'border-fm-border'}`}><input type="radio" name="cliffhanger-option" checked={selectedCliffhanger === option.id} onChange={() => setSelectedCliffhanger(option.id)} className="sr-only" /><span className="block text-sm font-medium text-fm-primary">{option.title}</span><span className="mt-1 block text-xs leading-5 text-fm-secondary">{option.ending}</span><span className="mt-2 block text-xs text-fm-tertiary">{option.rationale}</span></label>)}</div>
                  <button onClick={() => void applyCliffhanger()} disabled={busy !== null || !selectedCliffhanger} className="mt-4 rounded-full bg-fm-red px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">{busy === 'rewrite' ? 'Saving ending…' : 'Apply selected ending to draft'}</button>
                </div>}
              </div>
              <NextButton onClick={() => setStep('Voice')}>Choose a voice</NextButton>
            </div>}

            {step === 'Voice' && <div>
              <StepHeading eyebrow="02 / Voice" title="Cast your narrator." text="Choose one of the available OpenAI text-to-speech voices." />
              <div className="mt-7 grid gap-2 sm:grid-cols-2">{OPENAI_VOICES.map((item) => <button key={item.id} onClick={() => setVoice(item.id)} className={`rounded-xl border p-4 text-left transition ${voice === item.id ? 'border-fm-red bg-fm-red/10' : 'border-fm-border bg-black/10 hover:border-fm-border-bright'}`}><p className="font-medium text-fm-primary">{item.label}</p><p className="mt-1 text-xs text-fm-tertiary">{item.description}</p></button>)}</div>
              <div className="mt-6 flex flex-wrap gap-3"><button onClick={() => void generateNarration()} disabled={busy !== null || !script.trim() || !hasSession} className="rounded-full bg-fm-red px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">{busy === 'narration' ? 'Generating narration…' : narrationPaths.length ? 'Regenerate narration' : `Generate with ${selectedVoice?.label}`}</button><NextButton onClick={() => setStep('Music')}>Choose music</NextButton></div>
            </div>}

            {step === 'Music' && <div>
              <StepHeading eyebrow="03 / Music" title="Set the atmosphere." text="Choose a background score for this episode." />
              <div className="mt-7 space-y-2">{music.map((track) => <button key={track.id} onClick={() => setMusicTrackId(track.id)} className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${musicTrackId === track.id ? 'border-fm-red bg-fm-red/10' : 'border-fm-border hover:border-fm-border-bright'}`}><span><span className="block font-medium text-fm-primary">{track.title}</span><span className="mt-1 block text-xs text-fm-tertiary">{track.mood}</span></span><span className="text-xs text-fm-secondary">{musicTrackId === track.id ? 'Selected' : 'Select'}</span></button>)}</div>
              {!music.length && <p className="mt-7 rounded-xl bg-black/20 p-4 text-sm text-fm-tertiary">Loading soundtrack choices…</p>}
              {selectedMusic && <div className="mt-4 rounded-xl border border-fm-border bg-black/20 p-4"><p className="mb-2 text-xs text-fm-tertiary">Preview: {selectedMusic.title}</p><audio controls preload="metadata" src={`/api/music/${selectedMusic.asset_key}`} className="w-full" /></div>}
              <NextButton onClick={() => setStep('Thumbnail')}>Create thumbnail</NextButton>
            </div>}

            {step === 'Thumbnail' && <div>
              <StepHeading eyebrow="04 / Thumbnail" title="Give it a face." text="Describe cover art and GPT Image will create a thumbnail for your episode." />
              <label className="mt-7 block text-sm font-medium text-fm-secondary">Thumbnail prompt<textarea value={thumbnailPrompt} onChange={(event) => setThumbnailPrompt(event.target.value)} rows={5} className="mt-2 w-full resize-y rounded-xl border border-fm-border bg-black/20 p-3 leading-7 text-fm-primary outline-none focus:border-fm-border-bright" /></label>
              <div className="mt-5 flex flex-wrap items-center gap-4">{thumbnailUrl ? <img src={thumbnailUrl} alt="Generated episode thumbnail" className="size-28 rounded-xl object-cover" /> : <div className="flex size-28 items-center justify-center rounded-xl border border-dashed border-fm-border text-xs text-fm-tertiary">Cover art</div>}<button onClick={() => void generateThumbnail()} disabled={busy !== null || !thumbnailPrompt.trim() || !hasSession} className="rounded-full bg-fm-red px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{busy === 'thumbnail' ? 'Creating thumbnail…' : thumbnailPath ? 'Regenerate thumbnail' : 'Generate thumbnail'}</button></div>
              <NextButton onClick={() => setStep('Review')}>Review episode</NextButton>
            </div>}

            {step === 'Review' && <div>
              <StepHeading eyebrow="05 / Review" title="Ready to go live?" text="Review every creator choice before publishing." />
              <div className="mt-7 divide-y divide-fm-divider rounded-xl border border-fm-divider bg-black/10">{[
                ['Episode', title || 'Untitled episode'], ['Narration', narrationPaths.length ? `${selectedVoice?.label} · ${narrationPaths.length} generated part${narrationPaths.length === 1 ? '' : 's'}` : 'Not generated'], ['Background music', selectedMusic ? `${selectedMusic.title} · ${selectedMusic.mood}` : 'Not selected'], ['Thumbnail', thumbnailPath ? 'Generated and attached' : 'Not generated'],
              ].map(([label, value]) => <div key={label} className="flex justify-between gap-4 p-4 text-sm"><span className="text-fm-tertiary">{label}</span><span className="text-right text-fm-primary">{value}</span></div>)}</div>
              <EpisodePreview narrationUrls={narrationUrls} musicAssetKey={selectedMusic?.asset_key} musicName={selectedMusic?.title} />
              {blockers.length > 0 && <p className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">To publish, complete: {blockers.join(', ')}.</p>}
              <button onClick={() => void save('published')} disabled={busy !== null || blockers.length > 0 || !hasSession} className="mt-6 rounded-full bg-fm-red px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{busy === 'publish' ? 'Publishing…' : 'Publish episode'}</button>
            </div>}
          </div>

          <aside className="h-fit rounded-2xl border border-fm-divider bg-fm-surface p-5">
            <p className="text-xs font-medium tracking-[0.14em] text-fm-tertiary uppercase">Studio status</p>
            <p className="mt-3 text-sm leading-6 text-fm-secondary">{notice}</p>
            {!hasSession && <Link href="/profile" className="mt-5 inline-flex rounded-full border border-fm-border px-4 py-2 text-xs font-semibold text-fm-secondary transition hover:border-fm-border-bright hover:text-fm-primary">Go to Profile to sign in</Link>}
            <div className="mt-6 border-t border-fm-divider pt-5"><p className="text-sm font-medium text-fm-primary">What happens next?</p><p className="mt-2 text-xs leading-5 text-fm-tertiary">This same episode workflow is being designed so an MCP-connected AI agent can create it later — with your approval and the same secure backend.</p></div>
          </aside>
        </section>

        <section className="mt-10 border-t border-fm-divider pt-10" aria-labelledby="published-episodes-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium tracking-[0.16em] text-fm-red uppercase">Your catalog</p>
              <h2 id="published-episodes-heading" className="mt-2 text-2xl font-semibold text-fm-primary">Published episodes</h2>
              <p className="mt-2 text-sm text-fm-tertiary">Every live episode is kept here, ready to play and review.</p>
            </div>
            <span className="text-sm text-fm-tertiary">{publishedEpisodes.length} published</span>
          </div>
          {!hasSession ? <p className="mt-6 rounded-xl border border-dashed border-fm-border p-5 text-sm text-fm-tertiary">Sign in to view your published catalog.</p> : publishedEpisodes.length ? <div className="mt-6 grid gap-5 lg:grid-cols-2">{publishedEpisodes.map((episode) => <PublishedEpisodeCard key={episode.id} episode={episode} />)}</div> : <div className="mt-6 rounded-2xl border border-dashed border-fm-border bg-fm-surface p-6 text-sm text-fm-tertiary">Your published episodes will appear here after you go live.</div>}
        </section>
      </main>
    </>
  );
}

function StepHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <><p className="text-xs font-medium tracking-[0.16em] text-fm-red uppercase">{eyebrow}</p><h2 className="mt-3 text-2xl font-semibold text-fm-primary">{title}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-fm-tertiary">{text}</p></>;
}

function NextButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="mt-7 text-sm font-medium text-fm-secondary transition hover:text-fm-primary">{children} →</button>;
}

function EpisodePreview({ narrationUrls, musicAssetKey, musicName, heading = 'Listen before you publish', description }: { narrationUrls: string[]; musicAssetKey?: string; musicName?: string; heading?: string; description?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const [part, setPart] = useState(0);
  const [playing, setPlaying] = useState(false);

  function stopMusic() {
    if (musicRef.current) musicRef.current.pause();
  }

  async function playMix() {
    const audio = audioRef.current;
    if (!audio || !musicRef.current || !narrationUrls.length || !musicAssetKey) return;
    stopMusic();
    setPart(0);
    audio.currentTime = 0;
    musicRef.current.currentTime = 0;
    musicRef.current.volume = 0.13;
    await Promise.all([audio.play(), musicRef.current.play()]);
    setPlaying(true);
  }

  function onEnded() {
    const next = part + 1;
    if (next < narrationUrls.length) {
      setPart(next);
      stopMusic();
      setPlaying(false);
      return;
    }
    stopMusic();
    setPlaying(false);
  }

  if (!narrationUrls.length) {
    return <div className="mt-5 rounded-xl border border-dashed border-fm-border p-4 text-sm text-fm-tertiary">Generate narration to unlock the listening preview.</div>;
  }

  return (
    <div className="mt-5 rounded-xl border border-fm-border bg-fm-surface-2 p-4">
      <p className="text-sm font-medium text-fm-primary">{heading}</p>
      <p className="mt-1 text-xs leading-5 text-fm-tertiary">{description ?? `Preview the narrated episode with the selected ${musicName ?? 'background music'} track. Adjust the script, voice or mood, then regenerate before publishing.`}</p>
      <audio ref={audioRef} src={narrationUrls[part]} onEnded={onEnded} onPause={() => { if (playing) { stopMusic(); setPlaying(false); } }} className="mt-4 w-full" controls />
      {musicAssetKey && <audio ref={musicRef} src={`/api/music/${musicAssetKey}`} preload="metadata" />}
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-fm-tertiary">Part {part + 1} of {narrationUrls.length}</span>
        <button onClick={() => void playMix()} className="rounded-full bg-fm-red px-4 py-2 text-xs font-semibold text-white hover:bg-red-700">{playing ? 'Restart mixed preview' : 'Play mixed preview'}</button>
      </div>
    </div>
  );
}

function PublishedEpisodeCard({ episode }: { episode: PublishedEpisode }) {
  const [narrationUrls, setNarrationUrls] = useState<string[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadAssets() {
      const [{ data: audio }, { data: image }] = await Promise.all([
        supabase.storage.from('episode-audio').createSignedUrls(episode.narration_paths, 60 * 60),
        episode.thumbnail_path ? supabase.storage.from('episode-images').createSignedUrl(episode.thumbnail_path, 60 * 60) : Promise.resolve({ data: null }),
      ]);
      setNarrationUrls((audio ?? []).map((item) => item.signedUrl).filter((url): url is string => Boolean(url)));
      setThumbnailUrl(image?.signedUrl ?? null);
    }
    void loadAssets();
  }, [episode]);

  return <article className="overflow-hidden rounded-2xl border border-fm-divider bg-fm-surface p-5">
    <div className="flex gap-4">
      {thumbnailUrl ? <img src={thumbnailUrl} alt={`Cover art for ${episode.title}`} className="size-20 rounded-xl object-cover" /> : <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-fm-surface-2 text-xs text-fm-tertiary">EchoFM</div>}
      <div className="min-w-0"><p className="text-xs text-fm-tertiary">Published {episode.published_at ? new Date(episode.published_at).toLocaleDateString() : 'today'}</p><h3 className="mt-1 truncate text-lg font-semibold text-fm-primary">{episode.title}</h3><p className="mt-1 text-xs text-fm-secondary">{episode.voice ? `${episode.voice[0].toUpperCase()}${episode.voice.slice(1)} narration` : 'Narration'} · {episode.music_tracks?.title ?? 'No music'}</p></div>
    </div>
    <EpisodePreview narrationUrls={narrationUrls} musicAssetKey={episode.music_tracks?.asset_key} musicName={episode.music_tracks?.title} heading="Play episode" description={`Play the published narration with ${episode.music_tracks?.title ?? 'its selected background music'}.`} />
  </article>;
}
