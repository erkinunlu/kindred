-- Profil düzenleme sayfası için yeni alanlar
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS friendship_type TEXT,
  ADD COLUMN IF NOT EXISTS hangout_frequency TEXT,
  ADD COLUMN IF NOT EXISTS languages TEXT,
  ADD COLUMN IF NOT EXISTS profile_photos JSONB DEFAULT '[]';
