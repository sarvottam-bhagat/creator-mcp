with reel_episode as (
  select distinct on (reels.creator_id)
    reels.creator_id,
    reels.episode_id
  from public.marketing_reels as reels
  join public.marketing_ugc_videos as ugc on ugc.id = reels.ugc_video_id
  where ugc.title in (
    'She married a beggar',
    'Nobody knew his past',
    'The hidden letter',
    'The photograph',
    'The real rescue'
  )
  order by reels.creator_id, reels.created_at desc
)
update public.marketing_ugc_videos as ugc
set episode_id = reel_episode.episode_id
from reel_episode
where ugc.creator_id = reel_episode.creator_id
  and ugc.title in (
    'She married a beggar',
    'Nobody knew his past',
    'The hidden letter',
    'The photograph',
    'The real rescue'
  );
