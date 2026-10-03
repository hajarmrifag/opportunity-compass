-- Additive: coffee chats get a referral yes/no flag so the AI advisor can
-- spot referral gaps. Comments already live in the existing `notes` column;
-- nothing is removed or renamed.
ALTER TABLE public.coffee_chats
  ADD COLUMN IF NOT EXISTS referral boolean NOT NULL DEFAULT false;
