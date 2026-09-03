CREATE TABLE IF NOT EXISTS public.business_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  website_url text NOT NULL,
  depth text NOT NULL DEFAULT 'deep',
  status text NOT NULL DEFAULT 'scanning',
  pages_scanned integer NOT NULL DEFAULT 0,
  profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  brief_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  assets_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_profiles TO authenticated;
GRANT ALL ON public.business_profiles TO service_role;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own business profiles" ON public.business_profiles FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS business_profiles_owner_idx ON public.business_profiles(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.business_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  url text NOT NULL,
  page_type text NOT NULL DEFAULT 'other',
  title text,
  extracted_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_pages TO authenticated;
GRANT ALL ON public.business_pages TO service_role;
ALTER TABLE public.business_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own business pages" ON public.business_pages FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS business_pages_profile_idx ON public.business_pages(profile_id);

CREATE TRIGGER business_profiles_set_updated_at BEFORE UPDATE ON public.business_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cast_members
  ADD COLUMN IF NOT EXISTS reference_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS primary_reference_path text,
  ADD COLUMN IF NOT EXISTS appearance_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS appearance_prompt text,
  ADD COLUMN IF NOT EXISTS voice_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS voice_provider text,
  ADD COLUMN IF NOT EXISTS voice_provider_ref text,
  ADD COLUMN IF NOT EXISTS generation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS generation_seed integer,
  ADD COLUMN IF NOT EXISTS consent_by text,
  ADD COLUMN IF NOT EXISTS consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_scope text;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS business_profile_id uuid REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS character_id uuid REFERENCES public.cast_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shot_list_json jsonb;