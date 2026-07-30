-- Run this in Supabase SQL editor to fix the join league flow
-- Creates a SECURITY DEFINER function that bypasses RLS for joining leagues

CREATE OR REPLACE FUNCTION join_league_by_code(invite_code TEXT, user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_league leagues%ROWTYPE;
  member_count INT;
  existing_id UUID;
BEGIN
  -- Look up league by invite code
  SELECT * INTO target_league FROM public.leagues WHERE leagues.invite_code = join_league_by_code.invite_code;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invalid invite code');
  END IF;

  -- Check league status allows joining
  IF target_league.status NOT IN ('draft', 'drafting') THEN
    RETURN json_build_object('error', 'League is no longer accepting new players');
  END IF;

  -- Check member count
  SELECT COUNT(*) INTO member_count FROM public.league_members WHERE league_id = target_league.id;
  IF member_count >= 6 THEN
    RETURN json_build_object('error', 'League is full (max 6 players)');
  END IF;

  -- Check if already a member
  SELECT id INTO existing_id FROM public.league_members WHERE league_id = target_league.id AND profile_id = user_id;
  IF FOUND THEN
    RETURN json_build_object('error', 'Already a member of this league');
  END IF;

  -- Insert membership
  INSERT INTO public.league_members (league_id, profile_id, team_name, team_color)
  VALUES (target_league.id, user_id, 'My Team', '#3388ff');

  -- Return league as JSON
  RETURN row_to_json(target_league)::json;
END;
$$;

-- Also allow joining during 'drafting' status in the regular INSERT policy
DROP POLICY IF EXISTS "Users can join leagues" ON league_members;
CREATE POLICY "Users can join leagues" ON league_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM leagues WHERE id = league_id AND status IN ('draft', 'drafting'))
);
