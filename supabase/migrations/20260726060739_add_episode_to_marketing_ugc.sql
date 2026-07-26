alter table public.marketing_ugc_videos
  add column episode_id uuid references public.episodes (id) on delete cascade;

create index marketing_ugc_videos_creator_episode_created_idx
  on public.marketing_ugc_videos (creator_id, episode_id, created_at desc);
