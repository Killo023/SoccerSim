-- Run this in your Supabase SQL editor to set up the database schema
-- All tables created first, then RLS + policies to avoid dependency issues

-- 1. TABLES
-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Leagues
CREATE TABLE leagues (
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

-- League members
CREATE TABLE league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL DEFAULT 'My Team',
  team_color TEXT NOT NULL DEFAULT '#ff4444',
  draft_completed BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(league_id, profile_id)
);

-- Draft picks
CREATE TABLE draft_picks (
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

-- Matches
CREATE TABLE matches (
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

-- 2. ROW LEVEL SECURITY
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- 3. POLICIES (ordered so no forward references to tables that don't yet exist)

-- Profiles
CREATE POLICY "Profiles are public" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INT := 0;
BEGIN
  base_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  final_username := base_username;

  -- If username taken, append numbers until unique
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || counter;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Leagues (references league_members which now exists)
CREATE POLICY "Anyone can look up leagues by invite code" ON leagues
  FOR SELECT USING (true);

CREATE POLICY "League members can view their leagues" ON leagues
  FOR SELECT USING (
    auth.uid() = owner_id OR
    EXISTS (SELECT 1 FROM league_members WHERE league_id = id AND profile_id = auth.uid())
  );

CREATE POLICY "Users can create leagues" ON leagues
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their leagues" ON leagues
  FOR UPDATE USING (auth.uid() = owner_id);

-- League members
CREATE POLICY "League members can view members" ON league_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM league_members lm WHERE lm.league_id = league_id AND lm.profile_id = auth.uid())
  );

CREATE POLICY "Users can join leagues" ON league_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM leagues WHERE id = league_id AND status = 'draft')
  );

CREATE POLICY "Members can update their own membership" ON league_members
  FOR UPDATE USING (profile_id = auth.uid());

-- Draft picks
CREATE POLICY "League members can view draft picks" ON draft_picks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM league_members WHERE league_id = draft_picks.league_id AND profile_id = auth.uid())
  );

CREATE POLICY "Members can insert their own draft picks" ON draft_picks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM league_members WHERE id = member_id AND profile_id = auth.uid())
  );

-- Matches
CREATE POLICY "League members can view matches" ON matches
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM league_members WHERE league_id = matches.league_id AND profile_id = auth.uid())
  );

CREATE POLICY "Members can insert match results" ON matches
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM league_members WHERE league_id = matches.league_id AND profile_id = auth.uid())
  );
