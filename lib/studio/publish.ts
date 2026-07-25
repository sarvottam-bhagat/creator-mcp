export type PublishReadiness = {
  title: string;
  script: string;
  voice: string | null;
  musicTrackId: string | null;
  narrationPaths: string[];
  thumbnailPath: string | null;
};

export function getPublishBlockers(readiness: PublishReadiness): string[] {
  const blockers: string[] = [];

  if (!readiness.title.trim()) blockers.push('title');
  if (!readiness.script.trim()) blockers.push('script');
  if (!readiness.voice) blockers.push('voice');
  if (!readiness.musicTrackId) blockers.push('music');
  if (!readiness.narrationPaths.length) blockers.push('narration');
  if (!readiness.thumbnailPath) blockers.push('thumbnail');

  return blockers;
}
