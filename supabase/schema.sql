-- Run in Supabase SQL Editor. This migration is safe to rerun.
create extension if not exists pgcrypto;
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  father text not null check (length(father) between 2 and 160),
  text_ckb text not null check (length(text_ckb) between 1 and 5000),
  text_kmr text not null check (length(text_kmr) between 1 and 5000),
  reference text not null,
  source_url text not null,
  topic text not null,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  publisher text not null,
  url text not null,
  content text not null,
  keywords text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
alter table public.quotes enable row level security;
alter table public.sources enable row level security;
-- All table access goes through the API. No client-accessible policies.
revoke all on public.admins, public.quotes, public.sources from anon, authenticated;
grant all on public.admins, public.quotes, public.sources to service_role;
create index if not exists quotes_published_created on public.quotes(published,created_at desc);
create index if not exists sources_approved on public.sources(approved);
-- After creating your user in Authentication > Users, add its UUID below:
-- insert into public.admins(user_id) values ('YOUR-AUTH-USER-UUID') on conflict do nothing;
