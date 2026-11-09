-- Add account_type column to profiles table so individual vs business
-- distinction is persisted at the database level for every user.
-- Existing rows default to 'business' which is the safe fallback.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'business'
  CHECK (account_type IN ('business', 'individual'));

-- Backfill any existing individual accounts whose account_type was only
-- stored in Supabase Auth user_metadata but never written to the profiles table.
-- This reads from auth.users metadata and updates the matching profile row.
UPDATE public.profiles p
SET account_type = 'individual'
FROM auth.users u
WHERE u.id = p.id
  AND (u.raw_user_meta_data->>'account_type') = 'individual'
  AND p.account_type = 'business';

-- Index for fast filtering (tab gating, KB fetching, ticket routing all query this)
CREATE INDEX IF NOT EXISTS idx_profiles_account_type
  ON public.profiles(account_type);

