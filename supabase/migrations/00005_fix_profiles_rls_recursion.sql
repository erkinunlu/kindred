-- RLS infinite recursion düzeltmesi
-- "Approved users can view other approved profiles" politikası profiles'dan okurken
-- aynı politikayı tetikliyordu. SECURITY DEFINER fonksiyon ile RLS bypass ediyoruz.

CREATE OR REPLACE FUNCTION public.current_user_has_approved_profile()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND status = 'approved'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Eski politikayı kaldır
DROP POLICY IF EXISTS "Approved users can view other approved profiles" ON public.profiles;

-- Yeni politika: SECURITY DEFINER fonksiyon kullanır, recursion yok
-- (Kendi profili "Users can view own profile" ile zaten görülebilir)
CREATE POLICY "Approved users can view other approved profiles" ON public.profiles
  FOR SELECT USING (public.current_user_has_approved_profile());
