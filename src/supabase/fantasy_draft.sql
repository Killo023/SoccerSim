-- ============================================================
-- FANTASY DRAFT MIGRATION — Run this in the SQL Editor
-- Adds manager selection + chemistry/proficiency data to the
-- online league draft. Safe to re-run (uses IF NOT EXISTS).
-- ============================================================

-- 1. COLUMNS
ALTER TABLE league_members ADD COLUMN IF NOT EXISTS manager_id TEXT;
ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS player_playstyle TEXT;
ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS player_nationality TEXT;
ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS player_rating INTEGER;

-- 2. FIRST-COME-FIRST-SERVED MANAGER SELECTION
-- At most one member per league may claim a given manager.
-- The partial unique index makes this race-free: the UPDATE below will
-- raise a unique_violation if another member already claimed it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_league_member_manager
  ON public.league_members (league_id, manager_id)
  WHERE manager_id IS NOT NULL;

CREATE OR REPLACE FUNCTION set_member_manager(p_member_id UUID, p_manager_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_league_id UUID;
BEGIN
  SELECT league_id INTO v_league_id FROM public.league_members WHERE id = p_member_id;
  IF v_league_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Member not found');
  END IF;

  BEGIN
    UPDATE public.league_members SET manager_id = p_manager_id WHERE id = p_member_id;
    RETURN jsonb_build_object('ok', true, 'manager_id', p_manager_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'Manager already taken');
  END;
END;
$$;

-- 3. UPDATED SAVE DRAFT PICKS (stores playstyle / nationality / rating)
CREATE OR REPLACE FUNCTION save_draft_picks(p_league_id UUID, p_member_id UUID, p_picks JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.draft_picks WHERE league_id = p_league_id AND member_id = p_member_id;
  IF jsonb_array_length(p_picks) > 0 THEN
    INSERT INTO public.draft_picks (league_id, member_id, player_name, player_club, position, attributes, player_playstyle, player_nationality, player_rating, pick_round, pick_order)
    SELECT
      p_league_id,
      p_member_id,
      (item->>'player_name')::TEXT,
      COALESCE((item->>'player_club')::TEXT, ''),
      COALESCE((item->>'position')::TEXT, ''),
      COALESCE((item->'attributes')::JSONB, '{}'::JSONB),
      COALESCE((item->>'player_playstyle')::TEXT, ''),
      COALESCE((item->>'player_nationality')::TEXT, ''),
      COALESCE((item->>'player_rating')::INTEGER, NULL),
      COALESCE((item->>'pick_round')::INTEGER, 0),
      COALESCE((item->>'pick_order')::INTEGER, 0)
    FROM jsonb_array_elements(p_picks) AS item;
  END IF;
END;
$$;
