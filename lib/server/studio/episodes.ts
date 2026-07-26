import type { PostgrestError } from '@supabase/supabase-js';

import { getPublishBlockers } from '../../studio/publish';
import { OPENAI_VOICES, type OpenAiVoice } from '../../studio/voices';
import type { StudioContext } from './context';
import { StudioError } from './errors';

export type EpisodeStatus = 'draft' | 'published';

export type SeriesRecord = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type MusicTrackRecord = {
  id: string;
  title: string;
  mood: string;
  duration_seconds: number;
  asset_key: string;
};

export type EpisodeRecord = {
  id: string;
  series_id: string;
  title: string;
  script: string;
  voice: string | null;
  music_track_id: string | null;
  narration_paths: string[];
  thumbnail_path: string | null;
  thumbnail_prompt: string;
  status: EpisodeStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateEpisodeRow = Pick<EpisodeRecord, 'series_id' | 'title' | 'script'> & {
  status: 'draft';
  published_at: null;
};

export type EpisodePatch = Partial<
  Pick<
    EpisodeRecord,
    | 'title'
    | 'script'
    | 'voice'
    | 'music_track_id'
    | 'narration_paths'
    | 'thumbnail_path'
    | 'thumbnail_prompt'
    | 'status'
    | 'published_at'
  >
>;

export interface EpisodeRepository {
  listSeries(): Promise<SeriesRecord[]>;
  findSeries(id: string): Promise<SeriesRecord | null>;
  createSeries(input: { creator_id: string; title: string }): Promise<SeriesRecord>;
  listEpisodes(filter?: { seriesId?: string; status?: EpisodeStatus }): Promise<EpisodeRecord[]>;
  findEpisode(id: string): Promise<EpisodeRecord | null>;
  createEpisode(input: CreateEpisodeRow): Promise<EpisodeRecord>;
  updateEpisode(id: string, patch: EpisodePatch): Promise<EpisodeRecord | null>;
  listMusicTracks(): Promise<MusicTrackRecord[]>;
  findMusicTrack(id: string): Promise<MusicTrackRecord | null>;
}

type EpisodeServiceOptions = {
  userId: string;
  repository: EpisodeRepository;
  now?: () => Date;
};

export type CreateEpisodeInput = {
  seriesId?: string;
  seriesTitle?: string;
  title: string;
  script?: string;
};

export type UpdateEpisodeInput = {
  title?: string;
  script?: string;
};

const EPISODE_COLUMNS =
  'id, series_id, title, script, voice, music_track_id, narration_paths, thumbnail_path, thumbnail_prompt, status, published_at, created_at, updated_at';
const SERIES_COLUMNS = 'id, creator_id, title, description, created_at, updated_at';
const MUSIC_COLUMNS = 'id, title, mood, duration_seconds, asset_key';
const voiceIds = new Set<string>(OPENAI_VOICES.map((voice) => voice.id));

function dependencyError(error: PostgrestError | null, message: string) {
  if (error) throw new StudioError('dependency_failed', message, 502);
}

export function createSupabaseEpisodeRepository(context: StudioContext): EpisodeRepository {
  const { supabase, user } = context;

  return {
    async listSeries() {
      const { data, error } = await supabase
        .from('series')
        .select(SERIES_COLUMNS)
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });
      dependencyError(error, 'EchoFM could not load your series.');
      return (data ?? []) as SeriesRecord[];
    },

    async findSeries(id) {
      const { data, error } = await supabase
        .from('series')
        .select(SERIES_COLUMNS)
        .eq('id', id)
        .eq('creator_id', user.id)
        .maybeSingle();
      dependencyError(error, 'EchoFM could not check that series.');
      return data as SeriesRecord | null;
    },

    async createSeries(input) {
      const { data, error } = await supabase
        .from('series')
        .insert(input)
        .select(SERIES_COLUMNS)
        .single();
      dependencyError(error, 'EchoFM could not create the series.');
      if (!data) throw new StudioError('dependency_failed', 'EchoFM could not create the series.', 502);
      return data as SeriesRecord;
    },

    async listEpisodes(filter = {}) {
      let query = supabase
        .from('episodes')
        // RLS already restricts episodes through their creator-owned series.
        // Avoid an embedded-relation filter here so OAuth-issued tokens use
        // the same reliable read path as the Studio client.
        .select(EPISODE_COLUMNS)
        .order('created_at', { ascending: false });
      if (filter.seriesId) query = query.eq('series_id', filter.seriesId);
      if (filter.status) query = query.eq('status', filter.status);
      const { data, error } = await query;
      dependencyError(error, 'EchoFM could not load your episodes.');
      return (data ?? []) as unknown as EpisodeRecord[];
    },

    async findEpisode(id) {
      const { data, error } = await supabase
        .from('episodes')
        .select(EPISODE_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      dependencyError(error, 'EchoFM could not load that episode.');
      return data as unknown as EpisodeRecord | null;
    },

    async createEpisode(input) {
      const { data, error } = await supabase
        .from('episodes')
        .insert(input)
        .select(EPISODE_COLUMNS)
        .single();
      dependencyError(error, 'EchoFM could not create the episode.');
      if (!data) throw new StudioError('dependency_failed', 'EchoFM could not create the episode.', 502);
      return data as EpisodeRecord;
    },

    async updateEpisode(id, patch) {
      const { data, error } = await supabase
        .from('episodes')
        .update(patch)
        .eq('id', id)
        .select(EPISODE_COLUMNS)
        .maybeSingle();
      dependencyError(error, 'EchoFM could not update the episode.');
      return data as EpisodeRecord | null;
    },

    async findMusicTrack(id) {
      const { data, error } = await supabase
        .from('music_tracks')
        .select(MUSIC_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      dependencyError(error, 'EchoFM could not check that soundtrack.');
      return data as MusicTrackRecord | null;
    },

    async listMusicTracks() {
      const { data, error } = await supabase
        .from('music_tracks')
        .select(MUSIC_COLUMNS)
        .order('title');
      dependencyError(error, 'EchoFM could not load the soundtrack catalog.');
      return (data ?? []) as MusicTrackRecord[];
    },
  };
}

function notFound() {
  return new StudioError('not_found', 'That episode was not found in your EchoFM Studio.', 404);
}

export function createEpisodeService({ userId, repository, now = () => new Date() }: EpisodeServiceOptions) {
  async function getEpisode(id: string) {
    const item = await repository.findEpisode(id);
    if (!item) throw notFound();
    return item;
  }

  async function getDraft(id: string) {
    const item = await getEpisode(id);
    if (item.status !== 'draft') {
      throw new StudioError(
        'invalid_input',
        'Published episodes are read-only. Return the episode to draft in Studio before editing it.',
        409,
      );
    }
    return item;
  }

  async function updateDraft(id: string, patch: EpisodePatch) {
    await getDraft(id);
    const updated = await repository.updateEpisode(id, patch);
    if (!updated) throw notFound();
    return updated;
  }

  return {
    listSeries: () => repository.listSeries(),
    listEpisodes: (filter?: { seriesId?: string; status?: EpisodeStatus }) =>
      repository.listEpisodes(filter),
    getEpisode,

    async createEpisode(input: CreateEpisodeInput) {
      let series: SeriesRecord | null;
      if (input.seriesId) {
        series = await repository.findSeries(input.seriesId);
        if (!series) {
          throw new StudioError('not_found', 'That series was not found in your EchoFM Studio.', 404);
        }
      } else {
        series = await repository.createSeries({
          creator_id: userId,
          title: input.seriesTitle?.trim() || 'My EchoFM series',
        });
      }
      return repository.createEpisode({
        series_id: series.id,
        title: input.title.trim() || 'Untitled episode',
        script: input.script ?? '',
        status: 'draft',
        published_at: null,
      });
    },

    async updateEpisode(id: string, input: UpdateEpisodeInput) {
      const patch: EpisodePatch = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.script !== undefined) patch.script = input.script;
      return updateDraft(id, patch);
    },

    // Any script rewrite invalidates the existing narration so a creator can
    // never publish audio that no longer matches the saved story.
    replaceScriptAndResetNarration: (id: string, script: string) =>
      updateDraft(id, { script, narration_paths: [] }),

    async selectVoice(id: string, voice: string) {
      if (!voiceIds.has(voice)) {
        throw new StudioError('invalid_input', 'Choose one of EchoFM’s supported narration voices.', 400);
      }
      return updateDraft(id, { voice: voice as OpenAiVoice });
    },

    async selectMusic(id: string, musicTrackId: string) {
      const track = await repository.findMusicTrack(musicTrackId);
      if (!track) {
        throw new StudioError('invalid_input', 'Choose a soundtrack from the EchoFM music catalog.', 400);
      }
      return updateDraft(id, { music_track_id: track.id });
    },

    attachNarration: (id: string, paths: string[]) => updateDraft(id, { narration_paths: paths }),

    attachThumbnail: (id: string, prompt: string, path: string) =>
      updateDraft(id, { thumbnail_prompt: prompt, thumbnail_path: path }),

    async publishEpisode(id: string, confirm: boolean) {
      if (!confirm) {
        throw new StudioError(
          'invalid_input',
          'Publishing requires explicit confirmation. Call again with confirm set to true.',
          400,
        );
      }
      const item = await getDraft(id);
      const blockers = getPublishBlockers({
        title: item.title,
        script: item.script,
        voice: item.voice,
        musicTrackId: item.music_track_id,
        narrationPaths: item.narration_paths,
        thumbnailPath: item.thumbnail_path,
      });
      if (blockers.length) {
        throw new StudioError(
          'not_ready',
          `Complete these items before publishing: ${blockers.join(', ')}.`,
          409,
        );
      }
      const published = await repository.updateEpisode(id, {
        status: 'published',
        published_at: now().toISOString(),
      });
      if (!published) throw notFound();
      return published;
    },
  };
}

export function createEpisodeServiceForContext(context: StudioContext) {
  return createEpisodeService({
    userId: context.user.id,
    repository: createSupabaseEpisodeRepository(context),
  });
}

export type EpisodeService = ReturnType<typeof createEpisodeService>;
