-- Supabase direct-connect setup for the GitHub Pages version.
-- Run this in Supabase Dashboard -> SQL Editor after the original schema and RLS SQL.
--
-- What this file does:
-- 1. Make public.dishes compatible with Supabase Storage image URLs.
-- 2. Keep the old image_blob column optional for compatibility.
-- 3. Create or update the admin row as admin / admin for record keeping.
-- 4. Open the dish-images bucket for public read/upload/update/delete as requested.
--
-- Important:
-- The website uses only the anon public key. Never put a service_role key in GitHub Pages.

BEGIN;

ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS image_blob BYTEA,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_path TEXT,
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(80);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dishes'
      AND column_name = 'image_blob'
  ) THEN
    ALTER TABLE public.dishes ALTER COLUMN image_blob DROP NOT NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS dishes_image_path_idx ON public.dishes (image_path);

INSERT INTO public.users (username, password_hash, role)
VALUES (
  'admin',
  'supabase-admin-admin-v1:02b8486f882b4757a80937bb30c6b16faa9c6dd6128f1b32d6ffd557bd16c58b81ba1f4680411449d549f42745f4b2b2e1320bf92000bea6ef903aed4e96c62c',
  'admin'
)
ON CONFLICT (username)
DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = 'admin';

GRANT SELECT, INSERT, DELETE ON TABLE public.dishes TO anon, authenticated;
GRANT SELECT ON TABLE public.dish_comments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.weekly_menu_items TO anon, authenticated;

DROP POLICY IF EXISTS "Public can add dishes" ON public.dishes;
CREATE POLICY "Public can add dishes"
ON public.dishes
FOR INSERT
TO anon, authenticated
WITH CHECK (
  name IS NOT NULL
  AND length(trim(name)) > 0
  AND length(name) <= 120
  AND COALESCE(vote_count, 0) >= 0
  AND (
    image_blob IS NOT NULL
    OR (
      image_url IS NOT NULL
      AND length(trim(image_url)) > 0
      AND image_path IS NOT NULL
      AND length(trim(image_path)) > 0
    )
  )
  AND (
    mime_type IS NULL
    OR mime_type IN ('image/jpeg', 'image/jpg', 'image/png', 'image/webp')
  )
);

DROP POLICY IF EXISTS "Public can delete dishes" ON public.dishes;
CREATE POLICY "Public can delete dishes"
ON public.dishes
FOR DELETE
TO anon, authenticated
USING (true);

COMMIT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dish-images',
  'dish-images',
  true,
  12582912,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id)
DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

GRANT USAGE ON SCHEMA storage TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE storage.objects TO anon, authenticated;

DROP POLICY IF EXISTS "Public read dish images" ON storage.objects;
CREATE POLICY "Public read dish images"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'dish-images');

DROP POLICY IF EXISTS "Public upload dish images" ON storage.objects;
CREATE POLICY "Public upload dish images"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'dish-images');

DROP POLICY IF EXISTS "Public update dish images" ON storage.objects;
CREATE POLICY "Public update dish images"
ON storage.objects
FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'dish-images')
WITH CHECK (bucket_id = 'dish-images');

DROP POLICY IF EXISTS "Public delete dish images" ON storage.objects;
CREATE POLICY "Public delete dish images"
ON storage.objects
FOR DELETE
TO anon, authenticated
USING (bucket_id = 'dish-images');
