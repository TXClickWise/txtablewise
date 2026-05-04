-- Storage bucket for restaurant assets (logos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('restaurant-assets', 'restaurant-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: members of a restaurant may upload to {restaurant_id}/...
CREATE POLICY "restaurant members upload assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'restaurant-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT restaurant_id::text FROM public.restaurant_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "restaurant members update assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'restaurant-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT restaurant_id::text FROM public.restaurant_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "restaurant members delete assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'restaurant-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT restaurant_id::text FROM public.restaurant_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "public read restaurant assets"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'restaurant-assets');
