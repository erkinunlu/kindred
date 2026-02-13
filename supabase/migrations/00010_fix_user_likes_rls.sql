-- user_likes politikasını güncelle - liked_user_id ile sorgulama için
DROP POLICY IF EXISTS "Users can view own likes" ON public.user_likes;
CREATE POLICY "Users can view own likes" ON public.user_likes
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = liked_user_id);
