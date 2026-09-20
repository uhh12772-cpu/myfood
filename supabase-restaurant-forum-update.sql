-- Restaurant separation, public discussion board, and admin-only dish deletion.
-- Run this once in Supabase Dashboard -> SQL Editor after the earlier setup files.

BEGIN;

ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS restaurant_key TEXT;

UPDATE public.dishes
SET restaurant_key = 'hotbao'
WHERE restaurant_key IS NULL
   OR restaurant_key NOT IN ('hotbao', 'qilifang');

ALTER TABLE public.dishes
  ALTER COLUMN restaurant_key SET DEFAULT 'hotbao',
  ALTER COLUMN restaurant_key SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dishes'::regclass
      AND conname = 'dishes_restaurant_key_ck'
  ) THEN
    ALTER TABLE public.dishes
      ADD CONSTRAINT dishes_restaurant_key_ck
      CHECK (restaurant_key IN ('hotbao', 'qilifang'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS dishes_restaurant_vote_idx
ON public.dishes (restaurant_key, vote_count DESC, name ASC);

ALTER TABLE public.weekly_menu_items
  ADD COLUMN IF NOT EXISTS restaurant_key TEXT;

UPDATE public.weekly_menu_items
SET restaurant_key = 'hotbao'
WHERE restaurant_key IS NULL
   OR restaurant_key NOT IN ('hotbao', 'qilifang');

ALTER TABLE public.weekly_menu_items
  ALTER COLUMN restaurant_key SET DEFAULT 'hotbao',
  ALTER COLUMN restaurant_key SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.weekly_menu_items'::regclass
      AND conname = 'weekly_menu_restaurant_key_ck'
  ) THEN
    ALTER TABLE public.weekly_menu_items
      ADD CONSTRAINT weekly_menu_restaurant_key_ck
      CHECK (restaurant_key IN ('hotbao', 'qilifang'));
  END IF;
END;
$$;

-- Remove every older uniqueness rule that did not include restaurant_key.
-- This also covers databases created by older setup scripts where PostgreSQL
-- generated the constraint name automatically.
DO $$
DECLARE
  old_constraint TEXT;
BEGIN
  FOR old_constraint IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.weekly_menu_items'::regclass
      AND c.contype = 'u'
      AND EXISTS (
        SELECT 1
        FROM unnest(c.conkey) AS constraint_column(attnum)
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = constraint_column.attnum
        WHERE a.attname = 'weekday'
      )
      AND EXISTS (
        SELECT 1
        FROM unnest(c.conkey) AS constraint_column(attnum)
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = constraint_column.attnum
        WHERE a.attname = 'meal_type'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(c.conkey) AS constraint_column(attnum)
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = constraint_column.attnum
        WHERE a.attname = 'restaurant_key'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.weekly_menu_items DROP CONSTRAINT %I',
      old_constraint
    );
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.weekly_menu_items'::regclass
      AND conname = 'weekly_menu_restaurant_slot_order_uq'
  ) THEN
    ALTER TABLE public.weekly_menu_items
      ADD CONSTRAINT weekly_menu_restaurant_slot_order_uq
      UNIQUE (restaurant_key, weekday, meal_type, sort_order);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS weekly_menu_restaurant_slot_idx
ON public.weekly_menu_items (restaurant_key, weekday, meal_type, sort_order);

CREATE TABLE IF NOT EXISTS public.discussion_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.discussion_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  visitor_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT discussion_content_ck CHECK (
    length(trim(content)) BETWEEN 1 AND 1000
  )
);

CREATE INDEX IF NOT EXISTS discussion_comments_parent_idx
ON public.discussion_comments (parent_id, created_at ASC);

CREATE INDEX IF NOT EXISTS discussion_comments_root_idx
ON public.discussion_comments (created_at DESC)
WHERE parent_id IS NULL;

DROP TRIGGER IF EXISTS set_discussion_comments_updated_at ON public.discussion_comments;
CREATE TRIGGER set_discussion_comments_updated_at
BEFORE UPDATE ON public.discussion_comments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.discussion_comments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.discussion_comments FROM anon, authenticated;
GRANT SELECT ON TABLE public.discussion_comments TO anon, authenticated;

DROP POLICY IF EXISTS "Public can read discussion comments" ON public.discussion_comments;
CREATE POLICY "Public can read discussion comments"
ON public.discussion_comments
FOR SELECT
TO anon, authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.add_discussion_comment(
  p_parent_id UUID,
  p_content TEXT,
  p_visitor_key TEXT
)
RETURNS TABLE (
  id UUID,
  parent_id UUID,
  content TEXT,
  like_count INTEGER,
  visitor_key TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  clean_content TEXT := LEFT(TRIM(COALESCE(p_content, '')), 1000);
  clean_visitor_key TEXT := LEFT(TRIM(COALESCE(p_visitor_key, '')), 160);
BEGIN
  IF clean_content = '' THEN
    RAISE EXCEPTION 'comment content is required';
  END IF;
  IF clean_visitor_key = '' THEN
    RAISE EXCEPTION 'visitor key is required';
  END IF;
  IF p_parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.discussion_comments c WHERE c.id = p_parent_id
  ) THEN
    RAISE EXCEPTION 'parent comment not found';
  END IF;

  RETURN QUERY
  INSERT INTO public.discussion_comments AS c (parent_id, content, visitor_key)
  VALUES (p_parent_id, clean_content, clean_visitor_key)
  RETURNING c.id, c.parent_id, c.content, c.like_count, c.visitor_key, c.created_at, c.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.like_discussion_comment(p_comment_id UUID)
RETURNS TABLE (
  id UUID,
  like_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.discussion_comments AS c
  SET like_count = c.like_count + 1
  WHERE c.id = p_comment_id
  RETURNING c.id, c.like_count;
END;
$$;

-- The static site has a lightweight admin gate. These functions prevent the
-- ordinary public UI from deleting dishes directly. For production-grade
-- identity, replace the password parameter with Supabase Auth role checks.
CREATE OR REPLACE FUNCTION public.admin_delete_dish(
  p_dish_id UUID,
  p_admin_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(p_admin_password, '') <> 'admin' THEN
    RAISE EXCEPTION 'administrator authorization failed';
  END IF;
  DELETE FROM public.dishes d WHERE d.id = p_dish_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_all_dishes(p_admin_password TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  IF COALESCE(p_admin_password, '') <> 'admin' THEN
    RAISE EXCEPTION 'administrator authorization failed';
  END IF;
  DELETE FROM public.dishes;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE DELETE ON TABLE public.dishes FROM anon, authenticated;
DROP POLICY IF EXISTS "Public can delete dishes" ON public.dishes;

DROP POLICY IF EXISTS "Public can add dishes" ON public.dishes;
CREATE POLICY "Public can add dishes"
ON public.dishes
FOR INSERT
TO anon, authenticated
WITH CHECK (
  name IS NOT NULL
  AND length(trim(name)) > 0
  AND length(name) <= 120
  AND restaurant_key IN ('hotbao', 'qilifang')
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

DROP POLICY IF EXISTS "Public can add weekly menu rows" ON public.weekly_menu_items;
CREATE POLICY "Public can add weekly menu rows"
ON public.weekly_menu_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  restaurant_key IN ('hotbao', 'qilifang')
  AND weekday BETWEEN 1 AND 5
  AND meal_type IN ('breakfast', 'lunch', 'dinner')
  AND dish_name IS NOT NULL
  AND length(trim(dish_name)) BETWEEN 1 AND 120
  AND sort_order >= 0
);

DROP POLICY IF EXISTS "Public can update weekly menu rows" ON public.weekly_menu_items;
CREATE POLICY "Public can update weekly menu rows"
ON public.weekly_menu_items
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (
  restaurant_key IN ('hotbao', 'qilifang')
  AND weekday BETWEEN 1 AND 5
  AND meal_type IN ('breakfast', 'lunch', 'dinner')
  AND dish_name IS NOT NULL
  AND length(trim(dish_name)) BETWEEN 1 AND 120
  AND sort_order >= 0
);

REVOKE ALL ON FUNCTION public.add_discussion_comment(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.like_discussion_comment(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_dish(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_all_dishes(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.add_discussion_comment(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.like_discussion_comment(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_dish(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_all_dishes(TEXT) TO anon, authenticated;

COMMIT;
