alter table public.music_tracks
add column if not exists asset_key text;

update public.music_tracks
set asset_key = case id
  when 'night-drive' then 'a-tales'
  when 'soft-focus' then 'cinematic-piano'
  when 'midnight-rain' then 'in-the-distance'
  when 'golden-hour' then 'mallet-scape'
  when 'quiet-tension' then 'serious-scape'
  when 'city-lights' then 'celeste'
end;

insert into public.music_tracks (id, title, mood, duration_seconds, asset_key)
values ('slow-cinematic-piano', 'Slow Cinematic Piano', 'Reflective · full track', 180, 'slow-cinematic-piano')
on conflict (id) do update set
  title = excluded.title,
  mood = excluded.mood,
  asset_key = excluded.asset_key;

alter table public.music_tracks
alter column asset_key set not null;

alter table public.music_tracks
add constraint music_tracks_asset_key_unique unique (asset_key);
