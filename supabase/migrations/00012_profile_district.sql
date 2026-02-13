-- İlçe (district) alanı - konum "İlçe, İl" formatında gösterilecek
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS district TEXT;
