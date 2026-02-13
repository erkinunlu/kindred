import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import { VideoPlayer } from '@/components/VideoPlayer';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, fonts } from '@/constants/theme';

interface Post {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  post_type?: 'text' | 'image' | 'video';
  media_url?: string | null;
  profiles?: { full_name: string; avatar_url: string | null } | null;
  like_count?: number;
  is_liked?: boolean;
  comment_count?: number;
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Array<{ id: string; content: string; created_at: string; author: string }>>([]);
  const [commentInput, setCommentInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPost = async () => {
    if (!id) return;
    try {
      const { data: postData, error } = await supabase
        .from('posts')
        .select('id, content, created_at, user_id, post_type, media_url')
        .eq('id', id)
        .single();
      if (error || !postData) {
        setPost(null);
        return;
      }
      const { data: prof } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .eq('user_id', postData.user_id)
        .single();
      const likesRes = profile?.user_id
        ? await supabase.from('likes').select('post_id').eq('post_id', id).eq('user_id', profile.user_id)
        : { data: [] };
      const { data: likeCount } = await supabase.from('likes').select('post_id').eq('post_id', id);
      const { data: commentData } = await supabase
        .from('comments')
        .select('id, content, created_at, user_id')
        .eq('post_id', id)
        .order('created_at', { ascending: true });
      const userIds = [...new Set((commentData || []).map((c) => c.user_id))];
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      const pmap = new Map((profs || []).map((p) => [p.user_id, p.full_name]));
      setComments(
        (commentData || []).map((c) => ({
          id: c.id,
          content: c.content,
          created_at: c.created_at,
          author: pmap.get(c.user_id) || 'Anonim',
        }))
      );
      setPost({
        ...postData,
        profiles: prof || null,
        like_count: likeCount?.length || 0,
        is_liked: (likesRes.data || []).length > 0,
        comment_count: commentData?.length || 0,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPost();
  }, [id]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('tr-TR');
  };

  const toggleLike = async () => {
    if (!profile?.user_id || !post) return;
    try {
      if (post.is_liked) {
        await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', profile.user_id);
        setPost((p) => (p ? { ...p, is_liked: false, like_count: (p.like_count || 0) - 1 } : null));
      } else {
        await supabase.from('likes').insert({ post_id: post.id, user_id: profile.user_id });
        setPost((p) => (p ? { ...p, is_liked: true, like_count: (p.like_count || 0) + 1 } : null));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addComment = async () => {
    if (!commentInput.trim() || !profile?.user_id || !id) return;
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({ post_id: id, user_id: profile.user_id, content: commentInput.trim() })
        .select()
        .single();
      if (error) throw error;
      setCommentInput('');
      setComments((prev) => [
        ...prev,
        { id: data.id, content: data.content, created_at: data.created_at, author: profile?.full_name || 'Ben' },
      ]);
      setPost((p) => (p ? { ...p, comment_count: (p.comment_count || 0) + 1 } : null));
    } catch (err) {
      console.error(err);
    }
  };

  const goToUser = () => {
    if (post?.user_id) router.push(`/user/${post.user_id}`);
  };

  if (loading || !post) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>{loading ? 'Yükleniyor...' : 'Gönderi bulunamadı'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gönderi</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPost(); }} />}
      >
        <View style={styles.postCard}>
          <TouchableOpacity style={styles.postHeader} onPress={goToUser} activeOpacity={0.7}>
            {post.profiles?.avatar_url ? (
              <Image source={{ uri: post.profiles.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{post.profiles?.full_name?.charAt(0) || '?'}</Text>
              </View>
            )}
            <View style={styles.postHeaderText}>
              <Text style={styles.postAuthor}>{post.profiles?.full_name || 'Anonim'}</Text>
              <Text style={styles.postTime}>{formatDate(post.created_at)}</Text>
            </View>
          </TouchableOpacity>
          {post.media_url && (
            post.post_type === 'video' ? (
              <View style={styles.mediaContainer}>
                <VideoPlayer uri={post.media_url} />
              </View>
            ) : (
              <View style={styles.mediaContainer}>
                <Image source={{ uri: post.media_url }} style={styles.postMedia} resizeMode="cover" />
              </View>
            )
          )}
          {post.content ? <Text style={styles.postContent}>{post.content}</Text> : null}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={toggleLike}>
              <Ionicons name={post.is_liked ? 'heart' : 'heart-outline'} size={22} color={post.is_liked ? '#ef4444' : colors.textMuted} />
              <Text style={styles.actionCount}>{post.like_count || 0}</Text>
            </TouchableOpacity>
            <View style={styles.actionBtn}>
              <Ionicons name="chatbubble-outline" size={22} color={colors.textMuted} />
              <Text style={styles.actionCount}>{post.comment_count || 0}</Text>
            </View>
          </View>
        </View>

        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>Yorumlar</Text>
          {comments.map((c) => (
            <View key={c.id} style={styles.commentRow}>
              <Text style={styles.commentAuthor}>{c.author}</Text>
              <Text style={styles.commentContent}>{c.content}</Text>
              <Text style={styles.commentTime}>{formatDate(c.created_at)}</Text>
            </View>
          ))}
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Yorum yaz..."
              placeholderTextColor={colors.textMuted}
              value={commentInput}
              onChangeText={setCommentInput}
              onSubmitEditing={addComment}
            />
            <TouchableOpacity onPress={addComment}>
              <Ionicons name="send" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  scroll: { padding: 16, paddingBottom: 32 },
  postCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  postHeaderText: { marginLeft: 12 },
  postAuthor: { fontSize: 16, fontWeight: '600', color: colors.text },
  postTime: { fontSize: 12, color: colors.textMuted },
  mediaContainer: { width: SCREEN_WIDTH, marginLeft: -32, marginBottom: 12, backgroundColor: colors.border },
  postMedia: { width: SCREEN_WIDTH, aspectRatio: 1, backgroundColor: colors.border },
  postContent: { fontSize: 15, color: colors.text, lineHeight: 22, marginBottom: 12 },
  actionsRow: { flexDirection: 'row', gap: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { fontSize: 14, color: colors.textMuted },
  commentsSection: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  commentsTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  commentRow: { marginBottom: 12 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  commentContent: { fontSize: 14, color: colors.text },
  commentTime: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  commentInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, fontFamily: fonts.regular },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: colors.textMuted },
});
