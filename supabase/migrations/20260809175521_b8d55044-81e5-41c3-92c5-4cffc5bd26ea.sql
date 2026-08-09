CREATE TABLE public.cast_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('character','voice')),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  reference_url text,
  rights_confirmed boolean NOT NULL DEFAULT false,
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cast_members TO authenticated;
GRANT ALL ON public.cast_members TO service_role;

ALTER TABLE public.cast_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own cast members" ON public.cast_members FOR ALL TO authenticated
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_cast_members_updated BEFORE UPDATE ON public.cast_members
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();