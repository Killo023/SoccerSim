-- ============================================================
-- COMPLETE SUPABASE SETUP — Run this entire script in SQL Editor
-- Safe to re-run multiple times (uses IF NOT EXISTS / DROP)
-- ============================================================

-- 1. TABLES
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'drafting', 'active', 'finished')),
  league_type TEXT NOT NULL DEFAULT 'epl',
  replaced_teams INTEGER NOT NULL DEFAULT 0,
  current_week INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL DEFAULT 'My Team',
  team_color TEXT NOT NULL DEFAULT '#ff4444',
  draft_completed BOOLEAN NOT NULL DEFAULT false,
  ready BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(league_id, profile_id)
);
ALTER TABLE league_members ADD COLUMN IF NOT EXISTS ready BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS draft_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES league_members(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  player_club TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT '',
  attributes JSONB NOT NULL DEFAULT '{}',
  pick_round INTEGER NOT NULL,
  pick_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  home_member_id UUID REFERENCES league_members(id) ON DELETE SET NULL,
  away_member_id UUID REFERENCES league_members(id) ON DELETE SET NULL,
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  home_goals INTEGER NOT NULL DEFAULT 0,
  away_goals INTEGER NOT NULL DEFAULT 0,
  home_shots INTEGER NOT NULL DEFAULT 0,
  away_shots INTEGER NOT NULL DEFAULT 0,
  home_shots_on_target INTEGER NOT NULL DEFAULT 0,
  away_shots_on_target INTEGER NOT NULL DEFAULT 0,
  home_possession INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'playing', 'finished')),
  played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS commentary TEXT;

-- 2. ROW LEVEL SECURITY
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- 3. HELPER FUNCTIONS (SECURITY DEFINER bypasses RLS)

-- Check membership WITHOUT referencing league_members (to avoid recursion)
CREATE OR REPLACE FUNCTION is_league_member(league_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.league_members WHERE league_members.league_id = is_league_member.league_id AND profile_id = is_league_member.user_id);
$$;

-- Join a league by invite code
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
  IF user_id <> auth.uid() THEN RETURN json_build_object('error', 'Not authorized'); END IF;
  SELECT * INTO target_league FROM public.leagues WHERE leagues.invite_code = join_league_by_code.invite_code;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Invalid invite code'); END IF;
  IF target_league.status NOT IN ('draft', 'drafting') THEN RETURN json_build_object('error', 'League is no longer accepting new players'); END IF;
  SELECT COUNT(*) INTO member_count FROM public.league_members WHERE league_id = target_league.id;
  IF member_count >= 6 THEN RETURN json_build_object('error', 'League is full (max 6 players)'); END IF;
  SELECT id INTO existing_id FROM public.league_members WHERE league_id = target_league.id AND profile_id = user_id;
  IF FOUND THEN RETURN json_build_object('error', 'Already a member of this league'); END IF;
  INSERT INTO public.league_members (league_id, profile_id, team_name, team_color) VALUES (target_league.id, user_id, 'My Team', '#3388ff');
  RETURN row_to_json(target_league)::json;
END;
$$;

-- Get all members of a league (bypasses RLS — used by lobby)
CREATE OR REPLACE FUNCTION get_league_members(target_league_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_to_json(m)) INTO result
  FROM (
    SELECT lm.*, row_to_json(p) AS profile
    FROM public.league_members lm
    LEFT JOIN public.profiles p ON p.id = lm.profile_id
    WHERE lm.league_id = target_league_id
  ) m;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Save draft picks (replace all picks for a member in one transaction)
CREATE OR REPLACE FUNCTION save_draft_picks(p_league_id UUID, p_member_id UUID, p_picks JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.draft_picks WHERE league_id = p_league_id AND member_id = p_member_id;
  IF jsonb_array_length(p_picks) > 0 THEN
    INSERT INTO public.draft_picks (league_id, member_id, player_name, player_club, position, attributes, pick_round, pick_order)
    SELECT
      p_league_id,
      p_member_id,
      (item->>'player_name')::TEXT,
      COALESCE((item->>'player_club')::TEXT, ''),
      COALESCE((item->>'position')::TEXT, ''),
      COALESCE((item->'attributes')::JSONB, '{}'::JSONB),
      COALESCE((item->>'pick_round')::INTEGER, 0),
      COALESCE((item->>'pick_order')::INTEGER, 0)
    FROM jsonb_array_elements(p_picks) AS item;
  END IF;
END;
$$;

-- Mark draft complete for a member
CREATE OR REPLACE FUNCTION mark_draft_complete(p_member_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.league_members SET draft_completed = true WHERE id = p_member_id;
$$;

-- Set a member's ready status
CREATE OR REPLACE FUNCTION set_member_ready(p_member_id UUID, p_ready BOOLEAN)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.league_members SET ready = p_ready WHERE id = p_member_id;
$$;

-- Update a member's team name/color
CREATE OR REPLACE FUNCTION update_member_team(p_member_id UUID, p_team_name TEXT, p_team_color TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.league_members SET team_name = p_team_name, team_color = p_team_color WHERE id = p_member_id;
$$;

-- Update league status
CREATE OR REPLACE FUNCTION update_league_status(p_league_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.leagues SET status = p_status WHERE id = p_league_id;
$$;

-- Check if all members have completed drafts
CREATE OR REPLACE FUNCTION all_drafts_complete(p_league_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*) > 0 AND bool_and(draft_completed)
  FROM public.league_members WHERE league_id = p_league_id;
$$;

-- 4. RLS POLICIES (drop + recreate)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Profiles are public" ON profiles;
  CREATE POLICY "Profiles are public" ON profiles FOR SELECT USING (true);

  DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
  CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

  DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
  CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

  DROP POLICY IF EXISTS "Anyone can look up leagues by invite code" ON leagues;
  CREATE POLICY "Anyone can look up leagues by invite code" ON leagues FOR SELECT USING (true);

  DROP POLICY IF EXISTS "League members can view their leagues" ON leagues;
  CREATE POLICY "League members can view their leagues" ON leagues FOR SELECT USING (
    auth.uid() = owner_id OR is_league_member(id, auth.uid())
  );

  DROP POLICY IF EXISTS "Users can create leagues" ON leagues;
  CREATE POLICY "Users can create leagues" ON leagues FOR INSERT WITH CHECK (auth.uid() = owner_id);

  DROP POLICY IF EXISTS "Owners can update their leagues" ON leagues;
  CREATE POLICY "Owners can update their leagues" ON leagues FOR UPDATE USING (auth.uid() = owner_id);

  -- league_members: simple policy — user can see their own row only
  -- (get_league_members RPC bypasses RLS for the lobby)
  DROP POLICY IF EXISTS "Members can view their own memberships" ON league_members;
  CREATE POLICY "Members can view their own memberships" ON league_members FOR SELECT USING (
    profile_id = auth.uid()
  );

  DROP POLICY IF EXISTS "Users can join leagues" ON league_members;
  CREATE POLICY "Users can join leagues" ON league_members FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM leagues WHERE id = league_id AND status IN ('draft', 'drafting'))
  );

  DROP POLICY IF EXISTS "Members can update their own membership" ON league_members;
  CREATE POLICY "Members can update their own membership" ON league_members FOR UPDATE USING (profile_id = auth.uid());

  DROP POLICY IF EXISTS "League members can view draft picks" ON draft_picks;
  CREATE POLICY "League members can view draft picks" ON draft_picks FOR SELECT USING (
    is_league_member(league_id, auth.uid())
  );

  DROP POLICY IF EXISTS "League members can view matches" ON matches;
  CREATE POLICY "League members can view matches" ON matches FOR SELECT USING (
    is_league_member(league_id, auth.uid())
  );

  DROP POLICY IF EXISTS "Members can insert match results" ON matches;
  CREATE POLICY "Members can insert match results" ON matches FOR INSERT WITH CHECK (
    is_league_member(league_id, auth.uid())
  );
END $$;

-- 5. AUTO-PROFILE TRIGGER
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INT := 0;
BEGIN
  base_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || counter;
  END LOOP;
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, final_username, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
