ALTER TABLE public.cast_members
  ADD COLUMN IF NOT EXISTS consent_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill existing confirmed characters with their owner as the confirming identity.
UPDATE public.cast_members
  SET consent_user_id = owner_id
  WHERE consent_user_id IS NULL AND rights_confirmed = true;