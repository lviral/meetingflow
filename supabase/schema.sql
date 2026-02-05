create extension if not exists "pgcrypto";

create table if not exists oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  provider text not null,
  access_token_enc text not null,
  refresh_token_enc text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create table if not exists weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  week_start date not null,
  total_cost numeric not null default 0,
  big_meeting_cost numeric not null default 0,
  people_hours numeric not null default 0,
  daily_cost_json jsonb not null default '{}'::jsonb,
  top_meetings_json jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);