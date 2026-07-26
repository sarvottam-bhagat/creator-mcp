create table public.marketing_ugc_videos (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  hook_script text not null,
  presenter text not null check (presenter in ('female', 'male')),
  duration_seconds integer not null check (duration_seconds between 3 and 10),
  provider text not null default 'openrouter',
  provider_model text not null,
  provider_job_id text,
  status text not null default 'queued' check (status in ('queued', 'generating', 'completed', 'failed')),
  video_path text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index marketing_ugc_videos_creator_created_idx
  on public.marketing_ugc_videos (creator_id, created_at desc);

create unique index marketing_ugc_videos_provider_job_idx
  on public.marketing_ugc_videos (provider_job_id)
  where provider_job_id is not null;

create trigger set_marketing_ugc_videos_updated_at
before update on public.marketing_ugc_videos
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.marketing_ugc_videos to authenticated;

alter table public.marketing_ugc_videos enable row level security;

create policy "Creators manage their own marketing UGC videos"
on public.marketing_ugc_videos for all
to authenticated
using ((select auth.uid()) = creator_id)
with check ((select auth.uid()) = creator_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketing-videos', 'marketing-videos', false, 52428800, array['video/mp4'])
on conflict (id) do update
set public = false,
    file_size_limit = 52428800,
    allowed_mime_types = array['video/mp4'];

create policy "Creators read their private marketing videos"
on storage.objects for select to authenticated
using (
  bucket_id = 'marketing-videos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Creators upload their private marketing videos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'marketing-videos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Creators update their private marketing videos"
on storage.objects for update to authenticated
using (
  bucket_id = 'marketing-videos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'marketing-videos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Creators delete their private marketing videos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'marketing-videos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
