-- Feature update for voting limits, survey forms, and admin-friendly cleanup.
-- Run this in Supabase Dashboard -> SQL Editor after new/supabase-direct-setup.sql.

BEGIN;

-- Older PostgreSQL exports used one row per weekday and meal. Upgrade them
-- before the page starts writing multiple dishes into one meal.
ALTER TABLE public.weekly_menu_items
  ADD COLUMN IF NOT EXISTS sort_order SMALLINT NOT NULL DEFAULT 0;

DO $$
DECLARE
  old_constraint TEXT;
BEGIN
  FOR old_constraint IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.weekly_menu_items'::regclass
      AND c.contype = 'u'
      AND c.conkey = ARRAY[
        (SELECT a.attnum
         FROM pg_attribute a
         WHERE a.attrelid = c.conrelid
           AND a.attname = 'weekday'
           AND NOT a.attisdropped),
        (SELECT a.attnum
         FROM pg_attribute a
         WHERE a.attrelid = c.conrelid
           AND a.attname = 'meal_type'
           AND NOT a.attisdropped)
      ]::smallint[]
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
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.weekly_menu_items'::regclass
      AND conname = 'weekly_menu_slot_order_uq'
  ) THEN
    ALTER TABLE public.weekly_menu_items
      ADD CONSTRAINT weekly_menu_slot_order_uq
      UNIQUE (weekday, meal_type, sort_order);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.dish_vote_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id UUID NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  voter_key TEXT NOT NULL,
  vote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dish_vote_records_one_dish_per_day_uq UNIQUE (dish_id, voter_key, vote_date)
);

CREATE INDEX IF NOT EXISTS dish_vote_records_voter_day_idx
ON public.dish_vote_records (voter_key, vote_date);

CREATE TABLE IF NOT EXISTS public.survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_key TEXT NOT NULL,
  option_key TEXT NOT NULL,
  comment TEXT,
  voter_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT survey_responses_one_answer_uq UNIQUE (survey_key, voter_key),
  CONSTRAINT survey_responses_key_ck CHECK (survey_key IN ('cafeteria_rating', 'canteen_choice')),
  CONSTRAINT survey_responses_option_ck CHECK (
    (survey_key = 'cafeteria_rating' AND option_key IN ('very_good', 'good', 'normal', 'bad', 'very_bad'))
    OR
    (survey_key = 'canteen_choice' AND option_key IN ('hotbao', 'qilifang'))
  )
);

CREATE INDEX IF NOT EXISTS survey_responses_key_option_idx
ON public.survey_responses (survey_key, option_key);

DROP TRIGGER IF EXISTS set_survey_responses_updated_at ON public.survey_responses;
CREATE TRIGGER set_survey_responses_updated_at
BEFORE UPDATE ON public.survey_responses
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.dish_vote_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read dish vote records" ON public.dish_vote_records;
DROP POLICY IF EXISTS "Public can read survey responses" ON public.survey_responses;

REVOKE ALL ON TABLE public.dish_vote_records FROM anon, authenticated;
REVOKE ALL ON TABLE public.survey_responses FROM anon, authenticated;

-- Remove the old one-argument RPC so it cannot bypass the daily limit.
DROP FUNCTION IF EXISTS public.vote_dish(UUID);

CREATE OR REPLACE FUNCTION public.get_vote_status(p_voter_key TEXT)
RETURNS TABLE (
  used_votes INTEGER,
  remaining_votes INTEGER,
  voted_dish_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  clean_voter_key TEXT := LEFT(TRIM(COALESCE(p_voter_key, '')), 160);
  vote_limit INTEGER := 15;
BEGIN
  IF clean_voter_key = '' THEN
    RAISE EXCEPTION 'voter key is required';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS used_votes,
    GREATEST(vote_limit - COUNT(*)::INTEGER, 0) AS remaining_votes,
    COALESCE(ARRAY_AGG(v.dish_id ORDER BY v.created_at), ARRAY[]::UUID[]) AS voted_dish_ids
  FROM public.dish_vote_records v
  WHERE v.voter_key = clean_voter_key
    AND v.vote_date = CURRENT_DATE;
END;
$$;

CREATE OR REPLACE FUNCTION public.vote_dish(p_dish_id UUID, p_voter_key TEXT)
RETURNS TABLE (
  id UUID,
  name VARCHAR(120),
  vote_count INTEGER,
  used_votes INTEGER,
  remaining_votes INTEGER,
  already_voted BOOLEAN,
  limit_reached BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  clean_voter_key TEXT := LEFT(TRIM(COALESCE(p_voter_key, '')), 160);
  existing_count INTEGER := 0;
  current_votes INTEGER := 0;
  current_name VARCHAR(120);
  already BOOLEAN := FALSE;
  limited BOOLEAN := FALSE;
  vote_limit INTEGER := 15;
BEGIN
  IF clean_voter_key = '' THEN
    RAISE EXCEPTION 'voter key is required';
  END IF;

  -- Serialize votes from the same browser identity for the current day.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(clean_voter_key || ':' || CURRENT_DATE::TEXT, 0)
  );

  SELECT d.vote_count, d.name
  INTO current_votes, current_name
  FROM public.dishes d
  WHERE d.id = p_dish_id;

  IF current_name IS NULL THEN
    RAISE EXCEPTION 'dish not found';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO existing_count
  FROM public.dish_vote_records v
  WHERE v.voter_key = clean_voter_key
    AND v.vote_date = CURRENT_DATE;

  IF EXISTS (
    SELECT 1
    FROM public.dish_vote_records v
    WHERE v.dish_id = p_dish_id
      AND v.voter_key = clean_voter_key
      AND v.vote_date = CURRENT_DATE
  ) THEN
    already := TRUE;
  ELSIF existing_count >= vote_limit THEN
    limited := TRUE;
  ELSE
    INSERT INTO public.dish_vote_records (dish_id, voter_key)
    VALUES (p_dish_id, clean_voter_key);

    UPDATE public.dishes d
    SET vote_count = d.vote_count + 1
    WHERE d.id = p_dish_id
    RETURNING d.vote_count, d.name INTO current_votes, current_name;

    existing_count := existing_count + 1;
  END IF;

  RETURN QUERY
  SELECT
    p_dish_id,
    current_name,
    current_votes,
    existing_count,
    GREATEST(vote_limit - existing_count, 0),
    already,
    limited;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_survey(
  p_survey_key TEXT,
  p_option_key TEXT,
  p_comment TEXT,
  p_voter_key TEXT
)
RETURNS TABLE (
  survey_key TEXT,
  option_key TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  clean_survey_key TEXT := TRIM(COALESCE(p_survey_key, ''));
  clean_option_key TEXT := TRIM(COALESCE(p_option_key, ''));
  clean_voter_key TEXT := LEFT(TRIM(COALESCE(p_voter_key, '')), 160);
  clean_comment TEXT := NULLIF(LEFT(TRIM(COALESCE(p_comment, '')), 500), '');
BEGIN
  IF clean_voter_key = '' THEN
    RAISE EXCEPTION 'voter key is required';
  END IF;

  INSERT INTO public.survey_responses (survey_key, option_key, comment, voter_key)
  VALUES (clean_survey_key, clean_option_key, clean_comment, clean_voter_key)
  ON CONFLICT (survey_key, voter_key)
  DO UPDATE SET
    option_key = EXCLUDED.option_key,
    comment = EXCLUDED.comment,
    updated_at = NOW();

  RETURN QUERY SELECT clean_survey_key, clean_option_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_survey_results(p_survey_key TEXT)
RETURNS TABLE (
  option_key TEXT,
  response_count INTEGER,
  total_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH options AS (
    SELECT unnest(
      CASE
        WHEN p_survey_key = 'cafeteria_rating'
          THEN ARRAY['very_good', 'good', 'normal', 'bad', 'very_bad']
        WHEN p_survey_key = 'canteen_choice'
          THEN ARRAY['hotbao', 'qilifang']
        ELSE ARRAY[]::TEXT[]
      END
    ) AS option_key
  ),
  counts AS (
    SELECT sr.option_key, COUNT(*)::INTEGER AS response_count
    FROM public.survey_responses sr
    WHERE sr.survey_key = p_survey_key
    GROUP BY sr.option_key
  ),
  total AS (
    SELECT COALESCE(SUM(c.response_count), 0)::INTEGER AS total_count FROM counts c
  )
  SELECT
    o.option_key,
    COALESCE(c.response_count, 0)::INTEGER,
    total.total_count
  FROM options o
  CROSS JOIN total
  LEFT JOIN counts c ON c.option_key = o.option_key;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vote_status(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vote_dish(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_survey(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_survey_results(TEXT) FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.weekly_menu_items
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_vote_status(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vote_dish(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_survey(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_survey_results(TEXT) TO anon, authenticated;

COMMIT;
