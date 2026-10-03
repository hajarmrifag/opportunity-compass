-- Tracker career dashboard additions (additive only).

-- 1. Allow the "assessment" application status alongside the existing seven.
alter table public.applications drop constraint applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in ('saved','preparing','submitted','assessment','interview','offer','rejected','withdrawn'));

-- 2. Coffee chats: optional follow-up date and a fixed set of outcomes.
alter table public.coffee_chats add column if not exists follow_up_date date;
alter table public.coffee_chats add constraint coffee_chats_outcome_check
  check (outcome in ('','planned','responded','ghosted','follow_up_ghosted','successful_referral'));

-- 3. Email suggestions can point at an application or a coffee chat.
alter table public.email_suggestions add column if not exists kind text not null default 'application';
alter table public.email_suggestions add constraint email_suggestions_kind_check
  check (kind in ('application','coffee_chat'));
