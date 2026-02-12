-- Profil gizlilik ayarı
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_visible BOOLEAN DEFAULT true;

-- Hashtag desteği: post içeriğinde #hashtag formatı kullanılacak, arama için
-- Gündem sayfası content'te hashtag içeren gönderileri filtreleyecek
