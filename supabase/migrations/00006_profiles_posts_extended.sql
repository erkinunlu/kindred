-- Profil alanları genişletme (konum, sosyal medya)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS twitter TEXT,
  ADD COLUMN IF NOT EXISTS facebook TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Gönderi türü (metin, resim, video)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS post_type TEXT DEFAULT 'text' CHECK (post_type IN ('text', 'image', 'video')),
  ADD COLUMN IF NOT EXISTS media_url TEXT;
