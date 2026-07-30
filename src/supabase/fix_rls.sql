-- Run this in your Supabase SQL editor to fix invite code lookup for non-members
CREATE POLICY "Anyone can look up leagues by invite code" ON leagues
  FOR SELECT USING (true);
