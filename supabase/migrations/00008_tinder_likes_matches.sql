-- Tinder tarzı beğeni (swipe right)
CREATE TABLE IF NOT EXISTS public.user_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  liked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, liked_user_id),
  CHECK (user_id != liked_user_id)
);

ALTER TABLE public.user_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own likes" ON public.user_likes
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = liked_user_id);

CREATE POLICY "Users can insert own likes" ON public.user_likes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.status = 'approved')
  );

-- Geçti (swipe left) - tekrar göstermemek için
CREATE TABLE IF NOT EXISTS public.user_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  passed_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, passed_user_id),
  CHECK (user_id != passed_user_id)
);

ALTER TABLE public.user_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own passes" ON public.user_passes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own passes" ON public.user_passes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- İlgi alanları (profilde gösterilecek)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interests TEXT;
