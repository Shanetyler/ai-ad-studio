
-- 1) Bump signup grant to 50
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.subscriptions (user_id, tier, monthly_credit_grant)
  VALUES (NEW.id, 'free', 50) ON CONFLICT DO NOTHING;

  INSERT INTO public.credit_ledger (user_id, delta, reason)
  VALUES (NEW.id, 50, 'signup_grant');
  RETURN NEW;
END; $function$;

-- 2) Top up your account by +20 credits (30 -> 50 equivalent)
INSERT INTO public.credit_ledger (user_id, delta, reason)
VALUES ('b45a73d8-ae82-4039-ac6b-df71df1e4e4c', 20, 'signup_grant_bonus');

-- 3) Series table
CREATE TABLE public.series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  title text NOT NULL,
  brief text NOT NULL,
  length int NOT NULL CHECK (length IN (3, 7, 10)),
  aspect_ratio text NOT NULL DEFAULT '9:16',
  timeline_type text NOT NULL DEFAULT 'campaign', -- 'campaign' | 'countdown' | 'launch'
  continuity_json jsonb NOT NULL DEFAULT '{}'::jsonb, -- {character, style, voice, offer, deadline, keep:{...}}
  status text NOT NULL DEFAULT 'planning',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.series TO authenticated;
GRANT ALL ON public.series TO service_role;

ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "series_owner_all" ON public.series
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER series_set_updated_at
  BEFORE UPDATE ON public.series
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Link projects to series
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES public.series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS series_index int;

CREATE INDEX IF NOT EXISTS projects_series_idx ON public.projects(series_id, series_index);
