import { getPublishBlockers } from '../../studio/publish';
import type { StudioContext } from './context';
import {
  createEpisodeServiceForContext,
  createSupabaseEpisodeRepository,
  type EpisodeRecord,
  type MusicTrackRecord,
} from './episodes';
import { StudioError } from './errors';

export type ReviewDependencies = {
  getEpisode(id: string): Promise<EpisodeRecord>;
  findMusicTrack(id: string): Promise<MusicTrackRecord | null>;
  sign(bucket: 'episode-audio' | 'episode-images', path: string): Promise<string>;
};

export function createReviewDependencies(context: StudioContext): ReviewDependencies {
  const episodes = createEpisodeServiceForContext(context);
  const repository = createSupabaseEpisodeRepository(context);

  return {
    getEpisode: episodes.getEpisode,
    findMusicTrack: repository.findMusicTrack,
    async sign(bucket, path) {
      const { data, error } = await context.supabase.storage.from(bucket).createSignedUrl(path, 3_600);
      if (error || !data?.signedUrl) {
        throw new StudioError('dependency_failed', 'EchoFM could not create a private preview link.', 502);
      }
      return data.signedUrl;
    },
  };
}

function assertOwnedPath(userId: string, path: string) {
  if (!path.startsWith(`${userId}/`)) {
    throw new StudioError('not_found', 'That episode asset was not found in your EchoFM Studio.', 404);
  }
}

export async function reviewEpisode(
  context: StudioContext,
  episodeId: string,
  providedDependencies?: ReviewDependencies,
) {
  const dependencies = providedDependencies ?? createReviewDependencies(context);
  const episode = await dependencies.getEpisode(episodeId);
  const music = episode.music_track_id
    ? await dependencies.findMusicTrack(episode.music_track_id)
    : null;
  const blockers = getPublishBlockers({
    title: episode.title,
    script: episode.script,
    voice: episode.voice,
    musicTrackId: episode.music_track_id,
    narrationPaths: episode.narration_paths,
    thumbnailPath: episode.thumbnail_path,
  });

  const audio = await Promise.all(
    episode.narration_paths.map(async (path) => {
      assertOwnedPath(context.user.id, path);
      return {
        path,
        signedUrl: await dependencies.sign('episode-audio', path),
      };
    }),
  );

  let thumbnail: { path: string; signedUrl: string } | null = null;
  if (episode.thumbnail_path) {
    assertOwnedPath(context.user.id, episode.thumbnail_path);
    thumbnail = {
      path: episode.thumbnail_path,
      signedUrl: await dependencies.sign('episode-images', episode.thumbnail_path),
    };
  }

  return { episode, music, blockers, audio, thumbnail };
}

export type EpisodeReview = Awaited<ReturnType<typeof reviewEpisode>>;
