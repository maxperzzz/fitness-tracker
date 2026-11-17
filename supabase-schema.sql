-- Run this entire script in Supabase > SQL Editor.
-- The browser uses only the publishable/anon key. Never expose service_role.

create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_on date not null default current_date,
  meal text not null default 'Snack',
  name text not null,
  serving text,
  calories numeric(9,2) not null default 0,
  protein_g numeric(9,2) not null default 0,
  carbs_g numeric(9,2) not null default 0,
  fat_g numeric(9,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_on date not null default current_date,
  activity_type text not null,
  name text not null,
  duration_min integer not null default 0,
  intensity text,
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid references public.workout_logs(id) on delete cascade,
  exercise_name text not null,
  set_number integer,
  weight_kg numeric(8,2),
  reps integer,
  created_at timestamptz not null default now()
);
create table if not exists public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(6,2) not null,
  body_fat_pct numeric(5,2),
  waist_cm numeric(6,2),
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  taken_on date not null default current_date,
  caption text,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.food_logs enable row level security;
alter table public.workout_logs enable row level security;
alter table public.workout_sets enable row level security;
alter table public.body_metrics enable row level security;
alter table public.photos enable row level security;

create policy "Users manage own food logs" on public.food_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own workouts" on public.workout_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own workout sets" on public.workout_sets for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own body metrics" on public.body_metrics for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own photos" on public.photos for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Private image bucket. File path must start with the authenticated user's UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fitness-photos', 'fitness-photos', false, 8388608, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

create policy "Users upload own fitness photos" on storage.objects for insert to authenticated
with check (bucket_id = 'fitness-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users read own fitness photos" on storage.objects for select to authenticated
using (bucket_id = 'fitness-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own fitness photos" on storage.objects for delete to authenticated
using (bucket_id = 'fitness-photos' and (storage.foldername(name))[1] = auth.uid()::text);
