-- Run this in Supabase SQL editor to fix the signup trigger
-- Makes the auto-profile creation robust even if tables aren't ready

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INT := 0;
BEGIN
  -- Only try if the profiles table exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
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
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
