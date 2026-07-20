
CREATE POLICY "ad-videos own read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ad-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ad-videos own write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ad-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ad-videos own delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ad-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
