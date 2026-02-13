-- Gönderilere reaksiyon emojileri (like, love, haha, wow, sad, angry)
ALTER TABLE public.likes
  ADD COLUMN IF NOT EXISTS reaction_type TEXT DEFAULT 'like'
  CHECK (reaction_type IN ('like', 'love', 'haha', 'wow', 'sad', 'angry'));
