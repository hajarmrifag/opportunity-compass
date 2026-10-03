-- OpportunityOS – Application Plan. New tables only (prefix plan_).
-- Shared reference data: plan_requirements, plan_notices (readable by all, written by the team).
-- Private student data: plan_progress, plan_user_requirements (each student sees only their own rows).

create table if not exists public.plan_requirements (
  id text primary key,
  opportunity_id text not null,
  kind text not null check (kind in ('online_application','cv','cover_letter','transcript','references','written_answers',
                                     'online_test','video_interview','interview','portfolio','registration','other')),
  label text not null,
  stage text not null check (stage in ('application','assessment','interview','after_offer')),
  required boolean not null default true,
  due_date date,
  due_after text check (due_after in ('submitted','invited','offer')),
  due_after_days integer check (due_after_days is null or due_after_days >= 0),
  evidence_quote text,
  source_url text,
  source text not null default 'official_page' check (source in ('official_page','team')),
  status text not null default 'published' check (status in ('published','ai_extracted')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists plan_req_opp_idx on public.plan_requirements (opportunity_id);

create table if not exists public.plan_notices (
  id text primary key,
  opportunity_id text not null,
  text text not null,
  evidence_quote text,
  source_url text
);

-- Optional opportunity dates used by the plan (if your opportunities table already has them, map those instead).
create table if not exists public.plan_opportunity_dates (
  opportunity_id text primary key,
  application_deadline date,
  start_date date,
  application_url text          -- where students continue the application; falls back to the official page
);

create table if not exists public.plan_user_requirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  opportunity_id text not null,
  kind text not null,
  label text not null,
  stage text not null default 'application',
  required boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists plan_ureq_idx on public.plan_user_requirements (user_id, opportunity_id);

create table if not exists public.plan_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  opportunity_id text not null,
  item_key text not null,
  status text not null check (status in ('not_started','in_progress','ready','submitted','not_needed')),
  submitted_at date,
  updated_at timestamptz not null default now(),
  unique (user_id, opportunity_id, item_key)
);

alter table public.plan_requirements enable row level security;
alter table public.plan_notices enable row level security;
alter table public.plan_opportunity_dates enable row level security;
alter table public.plan_user_requirements enable row level security;
alter table public.plan_progress enable row level security;

-- Reference data: anyone can read, signed-in team members can write (restrict to an admin role before launch).
drop policy if exists "plan_requirements read" on public.plan_requirements;
create policy "plan_requirements read" on public.plan_requirements for select using (true);
drop policy if exists "plan_requirements team write" on public.plan_requirements;
create policy "plan_requirements team write" on public.plan_requirements for all to authenticated using (true) with check (true);

drop policy if exists "plan_notices read" on public.plan_notices;
create policy "plan_notices read" on public.plan_notices for select using (true);
drop policy if exists "plan_notices team write" on public.plan_notices;
create policy "plan_notices team write" on public.plan_notices for all to authenticated using (true) with check (true);

drop policy if exists "plan_dates read" on public.plan_opportunity_dates;
create policy "plan_dates read" on public.plan_opportunity_dates for select using (true);
drop policy if exists "plan_dates team write" on public.plan_opportunity_dates;
create policy "plan_dates team write" on public.plan_opportunity_dates for all to authenticated using (true) with check (true);

-- Private data: only the owner.
drop policy if exists "own user requirements" on public.plan_user_requirements;
create policy "own user requirements" on public.plan_user_requirements for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own progress" on public.plan_progress;
create policy "own progress" on public.plan_progress for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
