-- Additive: lets a student mark a coffee chat follow-up as done.
ALTER TABLE public.coffee_chats
  ADD COLUMN IF NOT EXISTS follow_up_done boolean NOT NULL DEFAULT false;
