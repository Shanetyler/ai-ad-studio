
CREATE POLICY "own files read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('brand-assets','project-assets','renders') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own files insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('brand-assets','project-assets','renders') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own files update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('brand-assets','project-assets','renders') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own files delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('brand-assets','project-assets','renders') AND (storage.foldername(name))[1] = auth.uid()::text);
