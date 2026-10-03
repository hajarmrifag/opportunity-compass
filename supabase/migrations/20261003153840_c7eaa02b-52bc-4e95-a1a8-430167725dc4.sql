-- Career dashboard: optional next action per application (additive only).
alter table public.applications add column if not exists next_action text not null default '';
alter table public.applications add column if not exists next_action_date date;
create index if not exists applications_user_next_action_idx
  on public.applications (user_id, next_action_date);
