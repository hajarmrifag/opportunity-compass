-- Tracker schema: per-user application tracking with RLS.
-- Additive only; nothing existing is changed or dropped.

-- Roles live in their own table (never on profiles/users).
-- Admin is granted only by manually inserting a row here; nothing grants it automatically.
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users read their own roles"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Applications: one row per (user, listing). Saving twice never duplicates.
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  listing_id text not null,
  company text not null,
  role text not null,
  status text not null default 'saved'
    check (status in ('saved','preparing','submitted','interview','offer','rejected','withdrawn')),
  source text not null default 'other'
    check (source in ('referral','cold','career_fair','other')),
  applied_date date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, listing_id)
);
grant select, insert, update, delete on public.applications to authenticated;
grant all on public.applications to service_role;
alter table public.applications enable row level security;
create policy "Users manage their own applications"
  on public.applications for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Status history: every status change appends one event row.
create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  status text not null
    check (status in ('saved','preparing','submitted','interview','offer','rejected','withdrawn')),
  date timestamptz not null default now(),
  source text not null default 'manual'
    check (source in ('manual','gmail'))
);
grant select, insert, update, delete on public.application_events to authenticated;
grant all on public.application_events to service_role;
alter table public.application_events enable row level security;
create policy "Users manage their own application events"
  on public.application_events for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table public.coffee_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  contact_name text not null,
  company text not null default '',
  date date,
  notes text not null default '',
  outcome text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.coffee_chats to authenticated;
grant all on public.coffee_chats to service_role;
alter table public.coffee_chats enable row level security;
create policy "Users manage their own coffee chats"
  on public.coffee_chats for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table public.outreach_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  channel text not null default 'email',
  body text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.outreach_templates to authenticated;
grant all on public.outreach_templates to service_role;
alter table public.outreach_templates enable row level security;
create policy "Users manage their own outreach templates"
  on public.outreach_templates for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Resources: one shared curated list. Any signed-in user reads; only admins write.
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text,
  tag text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.resources to authenticated;
grant all on public.resources to service_role;
alter table public.resources enable row level security;
create policy "Signed-in users read resources"
  on public.resources for select to authenticated
  using (true);
create policy "Admins insert resources"
  on public.resources for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins update resources"
  on public.resources for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete resources"
  on public.resources for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create table public.advice_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  date date not null default current_date,
  stats jsonb not null default '{}',
  advice text not null default '',
  resource_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.advice_log to authenticated;
grant all on public.advice_log to service_role;
alter table public.advice_log enable row level security;
create policy "Users manage their own advice log"
  on public.advice_log for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Email suggestions: one row per Gmail message per user. Owner-only.
create table public.email_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  gmail_message_id text not null,
  company text,
  role text,
  email_type text,
  event_datetime timestamptz,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  evidence text,
  state text not null default 'pending'
    check (state in ('pending','accepted','dismissed')),
  created_at timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);
grant select, insert, update, delete on public.email_suggestions to authenticated;
grant all on public.email_suggestions to service_role;
alter table public.email_suggestions enable row level security;
create policy "Users manage their own email suggestions"
  on public.email_suggestions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
