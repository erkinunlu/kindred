-- Add FK from posts to profiles for join support
ALTER TABLE public.posts
  ADD CONSTRAINT posts_profiles_fk
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
  ON DELETE CASCADE;
