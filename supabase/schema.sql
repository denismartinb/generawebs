create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text,
  status text not null default 'draft',
  generator_state jsonb not null default '{}'::jsonb,
  published_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists site_projects_set_updated_at on public.site_projects;
create trigger site_projects_set_updated_at
before update on public.site_projects
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.site_projects enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id);

drop policy if exists "projects_select_own" on public.site_projects;
create policy "projects_select_own"
on public.site_projects for select
using (auth.uid() = owner_id);

drop policy if exists "projects_insert_own" on public.site_projects;
create policy "projects_insert_own"
on public.site_projects for insert
with check (auth.uid() = owner_id);

drop policy if exists "projects_update_own" on public.site_projects;
create policy "projects_update_own"
on public.site_projects for update
using (auth.uid() = owner_id);

drop policy if exists "projects_delete_own" on public.site_projects;
create policy "projects_delete_own"
on public.site_projects for delete
using (auth.uid() = owner_id);
