with first_published_episode as (
  select distinct on (series.creator_id)
    series.creator_id,
    episodes.id as episode_id
  from public.episodes
  join public.series on series.id = episodes.series_id
  where episodes.status = 'published'
  order by series.creator_id, episodes.published_at asc nulls last, episodes.created_at asc
)
update public.marketing_ugc_videos as ugc
set episode_id = first_published_episode.episode_id
from first_published_episode
where ugc.creator_id = first_published_episode.creator_id
  and ugc.episode_id is null
  and ugc.title in (
    'She married a beggar',
    'Nobody knew his past',
    'The hidden letter',
    'The photograph',
    'The real rescue'
  );
