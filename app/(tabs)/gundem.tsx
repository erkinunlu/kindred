import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Image,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/theme';

interface Post {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles?: { full_name: string; avatar_url: string | null } | null;
  like_count?: number;
  is_liked?: boolean;
  post_type?: 'text' | 'image' | 'video';
  media_url?: string | null;
  comment_count?: number;
}

/** İçerikte #hashtag var mı kontrol eder */
function hasHashtag(content: string): boolean {
  return /#\w+/.test(content || '');
}

/** İçerikten hashtag'leri çıkarır */
function extractHashtags(content: string): string[] {
  const matches = (content || '').match(/#\w+/g);
  return matches ? [...new Set(matches)] : [];
}

export default function GundemScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPosts = async () => {
    try {
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('id, content, created_at, user_id, post_type, media_url')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        setPosts([]);
        return;
      }

      const withHashtags = (postsData || []).filter((p) => hasHashtag(p.content));
      const userIds = [...new Set(withHashtags.map((p) => p.user_id))];
      const postIds = withHashtags.map((p) => p.id);
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
        withHashtags.map((p) => ({
          ...p,
          profiles: pmap.get(p.user_id) || null,
          like_count: countMap.get(p.id) || 0,
          is_liked: likedSet.has(p.id),
          comment_count: cmap.get(p.id) || 0,
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

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


  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <Pressable onPress={() => router.push(`/post/${item.id}`)}>
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
              <Text style={styles.postTime}>{formatDate(item.created_at)}</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.hashtagBadges}>
            {extractHashtags(item.content).slice(0, 3).map((tag) => (
              <View key={tag} style={styles.hashtagBadge}>
                <Text style={styles.hashtagBadgeText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
        {item.media_url && (
          item.post_type === 'video' ? (
            <Video source={{ uri: item.media_url }} style={styles.postMedia} useNativeControls resizeMode={ResizeMode.COVER} />
          ) : (
            <Image source={{ uri: item.media_url }} style={styles.postMedia} resizeMode="cover" />
          )
        )}
        {item.content ? <Text style={styles.postContent}>{item.content}</Text> : null}
      </Pressable>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/post/${item.id}`)}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
          <Text style={styles.actionCount}>{item.comment_count || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/post/${item.id}`)}>
          <Ionicons name="heart-outline" size={20} color={colors.textMuted} />
          <Text style={styles.actionCount}>{item.like_count || 0}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="pricetag-outline" size={64} color={colors.textMuted} />
              <Text style={styles.emptyText}>Henüz hashtag içeren gönderi yok</Text>
              <Text style={styles.emptySubtext}>Gönderilerinde #hashtag kullan</Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(); }} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  list: { padding: 16, paddingBottom: 32 },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  postHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  postHeaderText: { marginLeft: 12, flex: 1 },
  feedAvatar: { width: 40, height: 40, borderRadius: 20 },
  feedAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedAvatarText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  postAuthor: { fontSize: 16, fontWeight: '600', color: colors.text },
  postTime: { fontSize: 12, color: colors.textMuted },
  hashtagBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  hashtagBadge: { backgroundColor: colors.primary + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  hashtagBadgeText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  postMedia: { width: '100%', height: 200, borderRadius: 8, marginBottom: 8, backgroundColor: colors.border },
  postContent: { fontSize: 15, color: colors.text, lineHeight: 22 },
  actionsRow: { flexDirection: 'row', gap: 20, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCount: { fontSize: 14, color: colors.textMuted },
  empty: { padding: 48, alignItems: 'center' },
  emptyText: { fontSize: 18, fontWeight: '600', color: colors.textMuted, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: colors.textMuted, marginTop: 8 },
});
