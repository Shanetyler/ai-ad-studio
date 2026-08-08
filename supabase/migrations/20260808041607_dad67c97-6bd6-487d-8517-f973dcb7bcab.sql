ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS business_json jsonb,
  ADD COLUMN IF NOT EXISTS plan_json jsonb,
  ADD COLUMN IF NOT EXISTS ad_type text,
  ADD COLUMN IF NOT EXISTS tone text,
  ADD COLUMN IF NOT EXISTS duration_target integer,
  ADD COLUMN IF NOT EXISTS render_provider text,
  ADD COLUMN IF NOT EXISTS video_mime text;

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS font_preference text,
  ADD COLUMN IF NOT EXISTS default_cta text,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'ad-videos own update'
  ) THEN
    CREATE POLICY "ad-videos own update" ON storage.objects FOR UPDATE
      USING (bucket_id = 'ad-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;