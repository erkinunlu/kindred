import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Image,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { uriToArrayBuffer, base64ToArrayBufferFromPicker } from '@/lib/uploadUtils';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/theme';

interface Post {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles?: {
    full_name: string;
    avatar_url: string | null;
  } | null;
  like_count?: number;
  is_liked?: boolean;
  post_type?: 'text' | 'image' | 'video';
  media_url?: string | null;
  comment_count?: number;
}

export default function FeedScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [postType, setPostType] = useState<'text' | 'image' | 'video'>('text');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaBase64, setMediaBase64] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const fetchPosts = async () => {
    try {
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('id, content, created_at, user_id, post_type, media_url')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Posts fetch error:', error);
        setPosts([]);
        return;
      }

      const userIds = [...new Set((postsData || []).map((p) => p.user_id))];
      const postIds = (postsData || []).map((p) => p.id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);
      const likesResult = profile?.user_id
        ? await supabase.from('likes').select('post_id').eq('user_id', profile.user_id).in('post_id', postIds)
        : { data: [] as { post_id: string }[] };
      const likeCountsResult = await supabase.from('likes').select('post_id').in('post_id', postIds);
      const { data: commentCounts } = await supabase.from('comments').select('post_id').in('post_id', postIds);
      const cmap = new Map<string, number>();
      (commentCounts || []).forEach((c: { post_id: string }) => {
        cmap.set(c.post_id, (cmap.get(c.post_id) || 0) + 1);
      });
      const pmap = new Map((profiles || []).map((p) => [p.user_id, p]));
      const likedSet = new Set((likesResult.data || []).map((l: { post_id: string }) => l.post_id));
      const countMap = new Map<string, number>();
      (likeCountsResult.data || []).forEach((l: { post_id: string }) => {
        countMap.set(l.post_id, (countMap.get(l.post_id) || 0) + 1);
      });
      setPosts(
        (postsData || []).map((p) => ({
          ...p,
          profiles: pmap.get(p.user_id) || null,
          like_count: countMap.get(p.id) || 0,
          is_liked: likedSet.has(p.id),
          comment_count: cmap.get(p.id) || 0,
        }))
      );
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} dk önce`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} saat önce`;
    return date.toLocaleDateString('tr-TR');
  };

  const pickMedia = async (type: 'image' | 'video') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin gerekli', 'Medya seçmek için galeri izni gereklidir.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'image' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: type === 'image',
      aspect: type === 'image' ? [1, 1] : undefined,
      quality: 0.8,
      base64: type === 'image',
    });
    const asset = result.canceled ? null : result.assets?.[0];
    if (asset?.uri) {
      setMediaUri(asset.uri);
      setMediaBase64(type === 'image' && asset.base64 ? asset.base64 : null);
      setPostType(type);
    }
  };

  const createPost = async () => {
    if ((!newPostContent.trim() && !mediaUri) || !profile?.user_id) return;
    setCreating(true);
    try {
      let mediaUrl: string | null = null;
      if (mediaUri) {
        const ext = postType === 'video' ? 'mp4' : 'jpg';
        const fileName = `${profile.user_id}/post_${Date.now()}.${ext}`;
        const contentType = postType === 'video' ? 'video/mp4' : 'image/jpeg';
        let uploadError: { message: string } | null = null;
        if (postType === 'video') {
          const formData = new FormData();
          formData.append('file', { uri: mediaUri, name: `video.${ext}`, type: contentType } as any);
          const res = await supabase.storage.from('avatars').upload(fileName, formData, { upsert: true, contentType });
          uploadError = res.error;
        } else {
          const arrayBuffer = mediaBase64
            ? base64ToArrayBufferFromPicker(mediaBase64)
            : await uriToArrayBuffer(mediaUri);
          const res = await supabase.storage
            .from('avatars')
            .upload(fileName, arrayBuffer, { upsert: true, contentType: 'image/jpeg' });
          uploadError = res.error;
        }
        if (uploadError) {
          console.error('Media upload error:', uploadError);
          Alert.alert('Hata', 'Medya yüklenemedi: ' + (uploadError.message || 'Bilinmeyen hata'));
          setCreating(false);
          return;
        }
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        mediaUrl = urlData?.publicUrl || null;
      }

      const { error } = await supabase.from('posts').insert({
        user_id: profile.user_id,
        content: newPostContent.trim() || (mediaUri ? '📷 Paylaşım' : ''),
        post_type: postType,
        media_url: mediaUrl,
      });
      if (error) {
        console.error('Post insert error:', error);
        throw new Error(error.message);
      }
      setShowCreateModal(false);
      setNewPostContent('');
      setMediaUri(null);
      setMediaBase64(null);
      setPostType('text');
      fetchPosts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gönderi oluşturulamadı.';
      Alert.alert('Hata', String(msg));
    } finally {
      setCreating(false);
    }
  };

  const [postComments, setPostComments] = useState<Record<string, Array<{ id: string; content: string; created_at: string; author: string }>>>({});

  const fetchComments = async (postId: string) => {
    const { data } = await supabase
      .from('comments')
      .select('id, content, created_at, user_id')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    const userIds = [...new Set((data || []).map((c) => c.user_id))];
    const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
    const pmap = new Map((profs || []).map((p) => [p.user_id, p.full_name]));
    setPostComments((prev) => ({
      ...prev,
      [postId]: (data || []).map((c) => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        author: pmap.get(c.user_id) || 'Anonim',
      })),
    }));
  };

  const toggleComments = (postId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else {
        next.add(postId);
        fetchComments(postId);
      }
      return next;
    });
  };

  const addComment = async (postId: string) => {
    const content = commentInputs[postId]?.trim();
    if (!content || !profile?.user_id) return;
    try {
      const { data, error } = await supabase.from('comments').insert({
        post_id: postId,
        user_id: profile.user_id,
        content,
      }).select().single();
      if (error) throw error;
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p
        )
      );
      if (data) {
        setPostComments((prev) => ({
          ...prev,
          [postId]: [
            ...(prev[postId] || []),
            { id: data.id, content: data.content, created_at: data.created_at, author: profile?.full_name || 'Ben' },
          ],
        }));
      }
    } catch (err) {
      console.error('Comment error:', err);
    }
  };

  const toggleLike = async (postId: string) => {
    if (!profile?.user_id) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    try {
      if (post.is_liked) {
        await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', profile.user_id);
      } else {
        await supabase.from('likes').insert({ post_id: postId, user_id: profile.user_id });
      }
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                is_liked: !p.is_liked,
                like_count: (p.like_count || 0) + (p.is_liked ? -1 : 1),
              }
            : p
        )
      );
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <Pressable
        style={styles.postContentArea}
        onPress={() => router.push(`/post/${item.id}`)}
      >
        <View style={styles.postHeader}>
          <TouchableOpacity
            style={styles.postHeaderLeft}
            onPress={() => router.push(`/user/${item.user_id}`)}
          >
            {item.profiles?.avatar_url ? (
              <Image source={{ uri: item.profiles.avatar_url }} style={styles.feedAvatar} />
            ) : (
              <View style={styles.feedAvatarPlaceholder}>
                <Text style={styles.feedAvatarText}>{item.profiles?.full_name?.charAt(0) || '?'}</Text>
              </View>
            )}
            <View style={styles.postHeaderText}>
              <Text style={styles.postAuthor}>{item.profiles?.full_name || 'Anonim'}</Text>
              <View style={styles.postMetaRow}>
                <Ionicons
                  name={item.post_type === 'video' ? 'videocam' : item.post_type === 'image' ? 'image' : 'document-text'}
                  size={12}
                  color={colors.primary}
                  style={styles.postTypeIcon}
                />
                <Text style={styles.postTime}>{formatDate(item.created_at)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      {item.media_url && (
        item.post_type === 'video' ? (
          <Video
            source={{ uri: item.media_url }}
            style={styles.postMedia}
            useNativeControls
            resizeMode={ResizeMode.COVER}
            isLooping
          />
        ) : (
          <Image
            key={item.id + (item.media_url || '')}
            source={{ uri: item.media_url }}
            style={styles.postMedia}
            resizeMode="cover"
          />
        )
      )}
      {item.content ? <Text style={styles.postContent}>{item.content}</Text> : null}
      </Pressable>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons
            name={item.is_liked ? 'heart' : 'heart-outline'}
            size={20}
            color={item.is_liked ? '#ef4444' : colors.textMuted}
          />
          <Text style={styles.actionCount}>{item.like_count || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => toggleComments(item.id)}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
          <Text style={styles.actionCount}>{item.comment_count || 0}</Text>
        </TouchableOpacity>
      </View>
      {expandedComments.has(item.id) && (
        <View style={styles.commentsSection}>
          {(postComments[item.id] || []).map((c) => (
            <View key={c.id} style={styles.commentRow}>
              <Text style={styles.commentAuthor}>{c.author}</Text>
              <Text style={styles.commentContent}>{c.content}</Text>
            </View>
          ))}
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Yorum yaz..."
              placeholderTextColor={colors.textMuted}
              value={commentInputs[item.id] || ''}
              onChangeText={(t) => setCommentInputs((prev) => ({ ...prev, [item.id]: t }))}
              onSubmitEditing={() => addComment(item.id)}
            />
            <TouchableOpacity onPress={() => addComment(item.id)}>
              <Ionicons name="send" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreateModal(true)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Yeni Gönderi</Text>
            <View style={styles.postTypeSelector}>
              <TouchableOpacity
                style={[styles.postTypeBtn, postType === 'text' && styles.postTypeActive]}
                onPress={() => { setPostType('text'); setMediaUri(null); setMediaBase64(null); }}
              >
                <Ionicons name="document-text" size={24} color={postType === 'text' ? colors.white : colors.textMuted} />
                <Text style={[styles.postTypeLabel, postType === 'text' && styles.postTypeLabelActive]}>Yazı</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.postTypeBtn, postType === 'image' && styles.postTypeActive]}
                onPress={() => pickMedia('image')}
              >
                <Ionicons name="image" size={24} color={postType === 'image' ? colors.white : colors.textMuted} />
                <Text style={[styles.postTypeLabel, postType === 'image' && styles.postTypeLabelActive]}>Resim</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.postTypeBtn, postType === 'video' && styles.postTypeActive]}
                onPress={() => pickMedia('video')}
              >
                <Ionicons name="videocam" size={24} color={postType === 'video' ? colors.white : colors.textMuted} />
                <Text style={[styles.postTypeLabel, postType === 'video' && styles.postTypeLabelActive]}>Video</Text>
              </TouchableOpacity>
            </View>
            {mediaUri && (
              <View style={styles.mediaPreview}>
                {postType === 'image' ? (
                  <Image source={{ uri: mediaUri }} style={styles.mediaPreviewImg} />
                ) : (
                  <Text style={styles.mediaPreviewText}>Video seçildi</Text>
                )}
                <TouchableOpacity style={styles.removeMedia} onPress={() => { setMediaUri(null); setMediaBase64(null); }}>
                  <Ionicons name="close" size={20} color={colors.white} />
                </TouchableOpacity>
              </View>
            )}
            <TextInput
              style={styles.modalInput}
              placeholder={postType === 'text' ? 'Ne paylaşmak istiyorsun?' : 'Açıklama ekle (isteğe bağlı)'}
              placeholderTextColor={colors.textMuted}
              value={newPostContent}
              onChangeText={setNewPostContent}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPost, creating && styles.buttonDisabled]}
                onPress={createPost}
                disabled={creating || (!newPostContent.trim() && !mediaUri)}
              >
                <Text style={styles.modalPostText}>
                  {creating ? 'Paylaşılıyor...' : 'Paylaş'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Henüz gönderi yok</Text>
              <Text style={styles.emptySubtext}>
                Arkadaşların paylaşım yapmaya başladığında burada görünecek
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  postContentArea: {},
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  postHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  postHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  feedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  feedAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  postTypeIcon: {
    opacity: 0.8,
  },
  postAuthor: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  postTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  postContent: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
  },
  postMedia: {
    width: '100%',
    height: 250,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: colors.border,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionCount: {
    fontSize: 14,
    color: colors.textMuted,
  },
  commentsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  commentRow: {
    marginBottom: 8,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  commentContent: {
    fontSize: 14,
    color: colors.text,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
  },
  postTypeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  postTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  postTypeActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  postTypeLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  postTypeLabelActive: {
    color: colors.white,
  },
  mediaPreview: {
    position: 'relative',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    height: 150,
  },
  mediaPreviewImg: {
    width: '100%',
    height: '100%',
  },
  mediaPreviewText: {
    backgroundColor: colors.border,
    height: '100%',
    textAlign: 'center',
    lineHeight: 150,
  },
  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoText: {
    marginTop: 4,
    color: colors.textSecondary,
  },
  removeMedia: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  modalCancel: {
    padding: 12,
    paddingHorizontal: 24,
  },
  modalCancelText: {
    color: '#6b7280',
    fontSize: 16,
  },
  modalPost: {
    backgroundColor: colors.primary,
    padding: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  modalPostText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
