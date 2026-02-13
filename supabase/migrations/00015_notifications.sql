-- Push token ve bildirimler
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- Bildirimler tablosu
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message', 'match', 'like', 'comment')),
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications (read)" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Mesaj bildirimi
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
BEGIN
  SELECT full_name INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, type, title, body, data, from_user_id)
  VALUES (NEW.receiver_id, 'message', COALESCE(sender_name, 'Biri'), LEFT(NEW.content, 100), jsonb_build_object('chatUserId', NEW.sender_id), NEW.sender_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_direct_message
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW
  WHEN (NEW.sender_id != NEW.receiver_id)
  EXECUTE FUNCTION public.notify_on_message();

-- Eşleşme bildirimi (her iki kullanıcıya)
CREATE OR REPLACE FUNCTION public.notify_on_match()
RETURNS TRIGGER AS $$
DECLARE
  name_a TEXT;
  name_b TEXT;
BEGIN
  SELECT full_name INTO name_a FROM public.profiles WHERE user_id = NEW.user_id;
  SELECT full_name INTO name_b FROM public.profiles WHERE user_id = NEW.friend_id;
  INSERT INTO public.notifications (user_id, type, title, body, data, from_user_id)
  VALUES (NEW.friend_id, 'match', 'Eşleşme!', COALESCE(name_a, 'Biri') || ' ile eşleştin', jsonb_build_object('matchUserId', NEW.user_id), NEW.user_id);
  INSERT INTO public.notifications (user_id, type, title, body, data, from_user_id)
  VALUES (NEW.user_id, 'match', 'Eşleşme!', COALESCE(name_b, 'Biri') || ' ile eşleştin', jsonb_build_object('matchUserId', NEW.friend_id), NEW.friend_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_friendship
  AFTER INSERT ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_match();

-- Beğeni bildirimi (gönderi sahibine)
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER AS $$
DECLARE
  post_owner UUID;
  liker_name TEXT;
BEGIN
  SELECT user_id INTO post_owner FROM public.posts WHERE id = NEW.post_id;
  IF post_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT full_name INTO liker_name FROM public.profiles WHERE user_id = NEW.user_id;
  INSERT INTO public.notifications (user_id, type, title, body, data, from_user_id, post_id)
  VALUES (post_owner, 'like', 'Gönderin beğenildi', COALESCE(liker_name, 'Biri') || ' gönderini beğendi', jsonb_build_object('postId', NEW.post_id), NEW.user_id, NEW.post_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_like
  AFTER INSERT ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_like();

-- Yorum bildirimi
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER AS $$
DECLARE
  post_owner UUID;
  commenter_name TEXT;
BEGIN
  SELECT user_id INTO post_owner FROM public.posts WHERE id = NEW.post_id;
  IF post_owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT full_name INTO commenter_name FROM public.profiles WHERE user_id = NEW.user_id;
  INSERT INTO public.notifications (user_id, type, title, body, data, from_user_id, post_id)
  VALUES (post_owner, 'comment', 'Yeni yorum', COALESCE(commenter_name, 'Biri') || ': ' || LEFT(NEW.content, 80), jsonb_build_object('postId', NEW.post_id), NEW.user_id, NEW.post_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_comment();
