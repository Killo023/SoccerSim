-- Run this entire script in Supabase SQL editor to fix missing tables and RLS policies
-- Safe to re-run multiple times

-- 1. Create any missing tables
CREATE TABLE IF NOT EXISTS league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL DEFAULT 'My Team',
  team_color TEXT NOT NULL DEFAULT '#ff4444',
  draft_completed BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(league_id, profile_id)
);

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

-- 2. Enable RLS on all tables
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS matches ENABLE ROW LEVEL SECURITY;

-- 3. Helper function that bypasses RLS to check league membership
-- This breaks the circular dependency between leagues and league_members policies
CREATE OR REPLACE FUNCTION is_league_member(league_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.league_members WHERE league_members.league_id = is_league_member.league_id AND profile_id = is_league_member.user_id);
$$;

-- 4. Drop and recreate all policies
DO $$ BEGIN
  -- Profiles
  DROP POLICY IF EXISTS "Profiles are public" ON profiles;
  CREATE POLICY "Profiles are public" ON profiles FOR SELECT USING (true);

  DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
  CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

  DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
  CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

  -- Leagues
  DROP POLICY IF EXISTS "Anyone can look up leagues by invite code" ON leagues;
  CREATE POLICY "Anyone can look up leagues by invite code" ON leagues FOR SELECT USING (true);

  DROP POLICY IF EXISTS "League members can view their leagues" ON leagues;
  -- Uses SECURITY DEFINER helper to avoid circular RLS
  CREATE POLICY "League members can view their leagues" ON leagues FOR SELECT USING (
    auth.uid() = owner_id OR
    is_league_member(id, auth.uid())
  );

  DROP POLICY IF EXISTS "Users can create leagues" ON leagues;
  CREATE POLICY "Users can create leagues" ON leagues FOR INSERT WITH CHECK (auth.uid() = owner_id);

  DROP POLICY IF EXISTS "Owners can update their leagues" ON leagues;
  CREATE POLICY "Owners can update their leagues" ON leagues FOR UPDATE USING (auth.uid() = owner_id);

  -- League members
  DROP POLICY IF EXISTS "Members can view their own memberships" ON league_members;
  -- Uses SECURITY DEFINER helper so that being a member in a league lets you see all members of that league
  CREATE POLICY "Members can view their own memberships" ON league_members FOR SELECT USING (
    profile_id = auth.uid() OR
    is_league_member(league_id, auth.uid())
  );

  DROP POLICY IF EXISTS "Users can join leagues" ON league_members;
  CREATE POLICY "Users can join leagues" ON league_members FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM leagues WHERE id = league_id AND status = 'draft')
  );

  DROP POLICY IF EXISTS "Members can update their own membership" ON league_members;
  CREATE POLICY "Members can update their own membership" ON league_members FOR UPDATE USING (profile_id = auth.uid());

  -- Draft picks
  DROP POLICY IF EXISTS "League members can view draft picks" ON draft_picks;
  CREATE POLICY "League members can view draft picks" ON draft_picks FOR SELECT USING (
    is_league_member(league_id, auth.uid())
  );

  DROP POLICY IF EXISTS "Members can insert their own draft picks" ON draft_picks;
  CREATE POLICY "Members can insert their own draft picks" ON draft_picks FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM league_members WHERE id = member_id AND profile_id = auth.uid())
  );

  -- Matches
  DROP POLICY IF EXISTS "League members can view matches" ON matches;
  CREATE POLICY "League members can view matches" ON matches FOR SELECT USING (
    is_league_member(league_id, auth.uid())
  );

  DROP POLICY IF EXISTS "Members can insert match results" ON matches;
  CREATE POLICY "Members can insert match results" ON matches FOR INSERT WITH CHECK (
    is_league_member(league_id, auth.uid())
  );
END $$;
