import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Share,
  Alert,
} from 'react-native';
import { Text as AppText } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, fonts } from '@/constants/theme';
import { VideoPlayer } from '@/components/VideoPlayer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const REACTIONS = [
  { type: 'like', icon: 'heart' as const, iconOutline: 'heart-outline' as const, label: 'Beğen' },
  { type: 'love', icon: 'heart-circle' as const, iconOutline: 'heart-circle-outline' as const, label: 'Sevdim' },
  { type: 'haha', icon: 'happy' as const, iconOutline: 'happy-outline' as const, label: 'Güldüm' },
  { type: 'wow', icon: 'star' as const, iconOutline: 'star-outline' as const, label: 'Vay' },
  { type: 'sad', icon: 'sad' as const, iconOutline: 'sad-outline' as const, label: 'Üzücü' },
  { type: 'angry', icon: 'flame' as const, iconOutline: 'flame-outline' as const, label: 'Kızdım' },
] as const;

type ReactionType = (typeof REACTIONS)[number]['type'];

interface Post {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  post_type?: 'text' | 'image' | 'video';
  media_url?: string | null;
  profiles?: { full_name: string; avatar_url: string | null } | null;
  like_count?: number;
  comment_count?: number;
  is_reacted?: boolean;
  my_reaction?: ReactionType | null;
  reactions?: Record<ReactionType, number>;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins} dk`;
  if (hours < 24) return `${hours} sa`;
  if (days < 7) return `${days} gün`;
  return d.toLocaleDateString('tr-TR');
}

function renderContentWithHashtags(text: string) {
  const parts = text.split(/(#\w+)/g).filter(Boolean);
  return parts.map((part, i) =>
    part.startsWith('#') ? (
      <AppText key={i} style={styles.hashtag}>{part}</AppText>
    ) : (
      part
    )
  );
}

function PostCard({
  post,
  onReaction,
  onComment,
  onUserPress,
  onShare,
}: {
  post: Post;
  onReaction: (postId: string, reactionType: ReactionType) => void;
  onComment: (postId: string) => void;
  onUserPress: (userId: string) => void;
  onShare: (postId: string) => void;
}) {
  const [showReactions, setShowReactions] = useState(false);

  const totalReactions = post.reactions
    ? Object.values(post.reactions).reduce((a, b) => a + b, 0)
    : post.like_count || 0;

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeaderRow}>
        <TouchableOpacity style={styles.postHeader} onPress={() => onUserPress(post.user_id)} activeOpacity={0.7}>
          {post.profiles?.avatar_url ? (
            <Image source={{ uri: post.profiles.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <AppText style={styles.avatarText}>{post.profiles?.full_name?.charAt(0) || '?'}</AppText>
            </View>
          )}
          <View style={styles.postHeaderText}>
            <AppText style={styles.postAuthor}>{post.profiles?.full_name || 'Anonim'}</AppText>
            <AppText style={styles.postTime}>{formatDate(post.created_at)}</AppText>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() =>
            Alert.alert('Gönderi', undefined, [
              { text: 'İptal', style: 'cancel' },
              { text: 'Bildir', onPress: () => {} },
              { text: 'Gizle', onPress: () => {} },
            ])
          }
        >
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {post.media_url && (
        <View style={styles.mediaContainer}>
          {post.post_type === 'video' ? (
            <VideoPlayer uri={post.media_url} />
          ) : (
            <TouchableOpacity onPress={() => onComment(post.id)} activeOpacity={1}>
              <Image source={{ uri: post.media_url }} style={styles.postMedia} resizeMode="cover" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {post.content ? (
        <TouchableOpacity onPress={() => onComment(post.id)} activeOpacity={1} style={styles.contentWrapper}>
          <AppText style={styles.postContent}>{renderContentWithHashtags(post.content)}</AppText>
        </TouchableOpacity>
      ) : null}

      <View style={styles.actionsRow}>
        <View style={styles.reactionArea}>
          <TouchableOpacity
            style={styles.reactionBtn}
            onPress={() => setShowReactions((v) => !v)}
          >
            <Ionicons
              name={post.my_reaction ? REACTIONS.find((r) => r.type === post.my_reaction)?.icon || 'heart-outline' : 'heart-outline'}
              size={22}
              color={post.my_reaction ? colors.primary : colors.textMuted}
            />
            {(totalReactions > 0 || post.my_reaction) && (
              <AppText style={styles.actionCount}>{totalReactions}</AppText>
            )}
          </TouchableOpacity>

          {showReactions && (
            <View style={styles.reactionPicker}>
              {REACTIONS.map((r) => (
                <TouchableOpacity
                  key={r.type}
                  style={styles.reactionOption}
                  onPress={() => {
                    onReaction(post.id, r.type);
                    setShowReactions(false);
                  }}
                >
                  <View style={styles.reactionIconWrap}>
                    <Ionicons name={r.iconOutline} size={26} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onComment(post.id)}>
          <Ionicons name="chatbubble-outline" size={22} color={colors.textMuted} />
          <AppText style={styles.actionCount}>{post.comment_count || 0}</AppText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onShare(post.id)}>
          <Ionicons name="share-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('id, content, created_at, user_id, post_type, media_url')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const postIds = (postsData || []).map((p) => p.id);
      const userIds = [...new Set((postsData || []).map((p) => p.user_id))];

      const [profilesRes, likesResRaw, commentsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', userIds),
        supabase.from('likes').select('post_id, user_id, reaction_type').in('post_id', postIds),
        supabase.from('comments').select('post_id').in('post_id', postIds),
      ]);
      const likesRes = likesResRaw.error
        ? await supabase.from('likes').select('post_id, user_id').in('post_id', postIds)
        : likesResRaw;

      const profMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p]));
      const commentCounts = (commentsRes.data || []).reduce((acc, c) => {
        acc[c.post_id] = (acc[c.post_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const myReactions = new Map<string, ReactionType>();
      const reactionCounts: Record<string, Record<ReactionType, number>> = {};
      (likesRes.data || []).forEach((l: { post_id: string; user_id: string; reaction_type?: string }) => {
        const rt = ((l.reaction_type || 'like') as ReactionType);
        if (REACTIONS.some((r) => r.type === rt)) {
          if (!reactionCounts[l.post_id]) {
            reactionCounts[l.post_id] = { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 };
          }
          reactionCounts[l.post_id][rt]++;
        } else {
          if (!reactionCounts[l.post_id]) {
            reactionCounts[l.post_id] = { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 };
          }
          reactionCounts[l.post_id].like++;
        }
        if (l.user_id === profile?.user_id) {
          myReactions.set(l.post_id, rt);
        }
      });

      setPosts(
        (postsData || []).map((p) => ({
          ...p,
          profiles: profMap.get(p.user_id) || null,
          like_count: Object.values(reactionCounts[p.id] || {}).reduce((a, b) => a + b, 0),
          comment_count: commentCounts[p.id] || 0,
          is_reacted: myReactions.has(p.id),
          my_reaction: myReactions.get(p.id) || null,
          reactions: reactionCounts[p.id] || { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
        }))
      );
    } catch (err) {
      console.error('Feed fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.user_id]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleReaction = async (postId: string, reactionType: ReactionType) => {
    if (!profile?.user_id) return;
    try {
      const post = posts.find((p) => p.id === postId);
      const hadReaction = post?.my_reaction;

      if (hadReaction) {
        await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', profile.user_id);
      }

      if (!hadReaction || hadReaction !== reactionType) {
        const { error } = await supabase.from('likes').upsert(
          { post_id: postId, user_id: profile.user_id, reaction_type: reactionType },
          { onConflict: 'user_id,post_id' }
        );
        if (error) {
          const { error: err2 } = await supabase.from('likes').upsert(
            { post_id: postId, user_id: profile.user_id },
            { onConflict: 'user_id,post_id' }
          );
          if (err2) throw err2;
        }
      }

      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const reactions = { ...(p.reactions || { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 }) };
          if (hadReaction) reactions[hadReaction] = Math.max(0, (reactions[hadReaction] || 1) - 1);
          if (!hadReaction || hadReaction !== reactionType) {
            reactions[reactionType] = (reactions[reactionType] || 0) + 1;
          }
          const newTotal = Object.values(reactions).reduce((a, b) => a + b, 0);
          return {
            ...p,
            my_reaction: hadReaction === reactionType ? null : reactionType,
            reactions,
            like_count: newTotal,
            is_reacted: hadReaction !== reactionType,
          };
        })
      );
    } catch (err) {
      console.error('Reaction error:', err);
    }
  };

  const handleComment = (postId: string) => {
    router.push(`/post/${postId}`);
  };

  const handleShare = async (postId: string) => {
    try {
      await Share.share({
        message: `KindRed gönderisi: ${postId}`,
        url: `kindred://post/${postId}`,
        title: 'KindRed',
      });
    } catch (e) {
      if ((e as Error).message?.includes('cancel')) return;
      console.warn('Share error:', e);
    }
  };

  if (loading && posts.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <AppText style={styles.loadingText}>Gönderiler yükleniyor...</AppText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onReaction={handleReaction}
            onComment={handleComment}
            onUserPress={(userId) => router.push(`/user/${userId}`)}
            onShare={handleShare}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppText style={styles.emptyText}>Henüz gönderi yok</AppText>
            <AppText style={styles.emptySubtext}>İlk gönderiyi sen paylaş!</AppText>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(); }} />}
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/post/create')}
        activeOpacity={0.8}
      >
        <Ionicons name="pencil" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 0, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: colors.textMuted },
  empty: { padding: 48, paddingHorizontal: 16, alignItems: 'center' },
  emptyText: { fontSize: 18, fontWeight: '600', color: colors.textMuted, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: colors.textMuted },
  postCard: {
    backgroundColor: '#fff',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  postHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  menuBtn: { padding: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  postHeaderText: { marginLeft: 12 },
  postAuthor: { fontSize: 16, fontWeight: '600', color: colors.text },
  postTime: { fontSize: 12, color: colors.textMuted },
  mediaContainer: { width: SCREEN_WIDTH, marginBottom: 12, backgroundColor: colors.border },
  postMedia: { width: SCREEN_WIDTH, aspectRatio: 1, backgroundColor: colors.border },
  contentWrapper: { paddingHorizontal: 16, marginBottom: 12 },
  postContent: { fontSize: 15, color: colors.text, lineHeight: 22 },
  hashtag: { color: colors.primary, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 16, paddingBottom: 16 },
  reactionArea: { position: 'relative' },
  reactionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reactionPicker: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reactionOption: { padding: 6 },
  reactionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fce7f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { fontSize: 14, color: colors.textMuted },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
  },
});
