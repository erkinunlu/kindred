-- Posts medya depolama bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('posts', 'posts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload posts media" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'posts' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Public posts read" ON storage.objects
  FOR SELECT USING (bucket_id = 'posts');
