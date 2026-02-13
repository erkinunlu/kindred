import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, fonts } from '@/constants/theme';

interface MatchUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  hasNewMessage?: boolean;
}

interface Conversation {
  id: string;
  participant: {
    full_name: string;
    avatar_url: string | null;
    isDeleted?: boolean;
  };
  last_message?: string;
  last_message_at?: string;
  last_sender_id?: string;
  unread_count?: number;
  is_online?: boolean;
}

function formatMessageTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(days / 7);

  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins} dk`;
  if (hours < 24) return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Dün';
  if (days < 7) return d.toLocaleDateString('tr-TR', { weekday: 'short' });
  if (weeks < 2) return '1 hafta önce';
  if (weeks < 4) return `${weeks} hafta önce`;
  return d.toLocaleDateString('tr-TR');
}

export default function MessagesScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [matches, setMatches] = useState<MatchUser[]>([]);
  const [likedYouCount, setLikedYouCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchMatchesAndLikedYou = useCallback(
    async (unreadUserIds?: Set<string>) => {
      if (!profile?.user_id) return;
      try {
        const { data: friends } = await supabase
          .from('friendships')
          .select('user_id, friend_id')
          .or(`user_id.eq.${profile.user_id},friend_id.eq.${profile.user_id}`);
        const friendIds = (friends || []).map((f) =>
          f.user_id === profile.user_id ? f.friend_id : f.user_id
        );
        if (friendIds.length === 0) {
          setMatches([]);
        } else {
          const { data: profs } = await supabase
            .from('profiles')
            .select('user_id, full_name, avatar_url')
            .in('user_id', friendIds)
            .eq('status', 'approved');
          setMatches(
            (profs || []).map((p) => ({
              user_id: p.user_id,
              full_name: p.full_name || 'Bilinmeyen',
              avatar_url: p.avatar_url,
              hasNewMessage: unreadUserIds?.has(p.user_id),
            }))
          );
        }

        const { data: likes } = await supabase
          .from('user_likes')
          .select('user_id')
          .eq('liked_user_id', profile.user_id);
        const likerIds = (likes || []).map((l) => l.user_id);
        const { data: friends2 } = await supabase
          .from('friendships')
        .select('user_id, friend_id')
          .or(`user_id.eq.${profile.user_id},friend_id.eq.${profile.user_id}`);
        const friendSet = new Set(
          (friends2 || []).flatMap((f) =>
            f.user_id === profile.user_id ? [f.friend_id] : [f.user_id]
          )
        );
        const pendingCount = likerIds.filter((id) => !friendSet.has(id)).length;
        setLikedYouCount(pendingCount);
    } catch (e) {
      console.error('Matches fetch error:', e);
    }
  }, [profile?.user_id]);

  const fetchConversations = useCallback(async (): Promise<Conversation[]> => {
    if (!profile?.user_id) return [];

    try {
      const { data: dmData } = await supabase
        .from('direct_messages')
        .select('id, sender_id, receiver_id, content, created_at')
        .or(`sender_id.eq.${profile.user_id},receiver_id.eq.${profile.user_id}`)
        .order('created_at', { ascending: false });

      const { data: blocked } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', profile.user_id);
      const blockedSet = new Set((blocked || []).map((b) => b.blocked_id));

      const otherUserIds = new Set<string>();
      const lastByUser: Record<
        string,
        { content: string; date: string; sender_id: string }
      > = {};

      (dmData || []).forEach((dm) => {
        const other =
          dm.sender_id === profile.user_id ? dm.receiver_id : dm.sender_id;
        otherUserIds.add(other);
        if (!lastByUser[other] || dm.created_at > lastByUser[other].date) {
          lastByUser[other] = {
            content: dm.content,
            date: dm.created_at,
            sender_id: dm.sender_id,
          };
        }
      });

      if (otherUserIds.size === 0) {
        setConversations([]);
        setLoading(false);
        return [];
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, status')
        .in('user_id', Array.from(otherUserIds));

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      const convos: Conversation[] = Array.from(otherUserIds)
        .filter((uid) => !blockedSet.has(uid))
        .map((uid) => {
          const p = profileMap.get(uid);
          const last = lastByUser[uid];
          const isDeleted = !p || p.status !== 'approved';
          const unread = last?.sender_id === uid ? 1 : 0;
          return {
            id: uid,
            participant: {
              full_name: p?.full_name || 'Bilinmeyen',
              avatar_url: p?.avatar_url || null,
              isDeleted,
            },
            last_message: last?.content,
            last_message_at: last?.date,
            last_sender_id: last?.sender_id,
            unread_count: unread,
            is_online: !isDeleted && Math.random() > 0.5,
          };
        });

      convos.sort((a, b) => {
        const da = a.last_message_at || '';
        const db = b.last_message_at || '';
        return db.localeCompare(da);
      });

      setConversations(convos);
      return convos;
    } catch (err) {
      console.error('Messages fetch error:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [profile?.user_id]);

  const load = useCallback(async () => {
    const convos = await fetchConversations();
    const unreadIds = new Set(
      convos.filter((c) => (c.unread_count || 0) > 0).map((c) => c.id)
    );
    await fetchMatchesAndLikedYou(unreadIds);
  }, [fetchMatchesAndLikedYou, fetchConversations]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const renderMatchItem = (item: MatchUser) => (
    <TouchableOpacity
      key={item.user_id}
      style={styles.matchItem}
      onPress={() => router.push(`/chat/${item.user_id}`)}
    >
      <View style={styles.matchAvatarWrap}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.matchAvatar} />
        ) : (
          <View style={[styles.matchAvatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>{item.full_name?.charAt(0) || '?'}</Text>
          </View>
        )}
        {item.hasNewMessage && <View style={styles.newDot} />}
      </View>
      <Text style={styles.matchName} numberOfLines={1}>
        {item.full_name}
      </Text>
    </TouchableOpacity>
  );

  const renderConversation = ({ item }: { item: Conversation }) => {
    const isUnread = (item.unread_count || 0) > 0;
    const isDeleted = item.participant.isDeleted;

    return (
      <TouchableOpacity
        style={[styles.conversationCard, isUnread && styles.conversationCardUnread]}
        onPress={() => router.push(`/chat/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrap}>
          {item.participant.avatar_url ? (
            <Image source={{ uri: item.participant.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {item.participant.full_name?.charAt(0) || '?'}
              </Text>
            </View>
          )}
          {!isDeleted && item.is_online && <View style={styles.onlineDot} />}
          {isDeleted && <View style={styles.offlineDot} />}
        </View>
        <View style={styles.conversationInfo}>
          <Text
            style={[
              styles.conversationName,
              isDeleted && styles.conversationNameDeleted,
            ]}
            numberOfLines={1}
          >
            {item.participant.full_name}
            {isDeleted && (
              <Text style={styles.deletedSuffix}> (Hesap Silindi)</Text>
            )}
          </Text>
          {item.last_message ? (
            <Text
              style={[
                styles.lastMessage,
                isUnread && styles.lastMessageUnread,
                isDeleted && styles.lastMessageDeleted,
              ]}
              numberOfLines={1}
            >
              {item.last_message}
            </Text>
          ) : null}
        </View>
        <View style={styles.conversationMeta}>
          {item.last_message_at && (
            <Text
              style={[
                styles.timeText,
                isUnread && styles.timeTextUnread,
                isDeleted && styles.timeTextDeleted,
              ]}
            >
              {formatMessageTime(item.last_message_at)}
            </Text>
          )}
          {isUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {item.unread_count! > 99 ? '99+' : item.unread_count}
              </Text>
            </View>
          )}
          {isUnread && !item.unread_count && <View style={styles.unreadDot} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitleNew}>YENİ EŞLEŞMELER</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.matchesRow}
          >
            {matches.map(renderMatchItem)}
            {likedYouCount > 0 && (
              <TouchableOpacity
                style={styles.likedYouItem}
                onPress={() => router.push('/(tabs)/likes')}
              >
                <View style={styles.likedYouCircle}>
                  <Ionicons name="heart" size={24} color={colors.primary} />
                </View>
                <Text style={styles.likedYouText}>{likedYouCount} Beğeni</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitleChats}>SOHBETLER</Text>
          {conversations.length === 0 && !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Henüz mesaj yok</Text>
              <Text style={styles.emptySubtext}>
                Arkadaş ekleyip sohbet başlattığında mesajlar burada görünecek
              </Text>
            </View>
          ) : (
            <View style={styles.chatList}>
              {conversations.map((item) => (
                <View key={item.id}>{renderConversation({ item })}</View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdf2f8',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  section: { marginBottom: 24 },
  sectionTitleNew: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 12,
    marginHorizontal: 16,
    letterSpacing: 0.5,
  },
  sectionTitleChats: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 12,
    marginHorizontal: 16,
    letterSpacing: 0.5,
  },
  matchesRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 16,
    paddingBottom: 8,
  },
  matchItem: { alignItems: 'center', width: 72 },
  matchAvatarWrap: { position: 'relative', marginBottom: 6 },
  matchAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  newDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#fdf2f8',
  },
  matchName: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  likedYouItem: { alignItems: 'center', width: 72 },
  likedYouCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  likedYouText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  chatList: { paddingHorizontal: 16 },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  conversationCardUnread: {
    backgroundColor: '#fce7f3',
    marginVertical: 4,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: '#fdf2f8',
  },
  offlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.textMuted,
    borderWidth: 2,
    borderColor: '#fdf2f8',
  },
  conversationInfo: { flex: 1, minWidth: 0 },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  conversationNameDeleted: {
    color: colors.textSecondary,
  },
  deletedSuffix: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  lastMessage: {
    fontSize: 14,
    color: colors.textMuted,
  },
  lastMessageUnread: {
    color: colors.text,
    fontWeight: '500',
  },
  lastMessageDeleted: {
    color: colors.textMuted,
  },
  conversationMeta: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  timeText: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  timeTextUnread: {
    color: colors.primary,
  },
  timeTextDeleted: {
    color: colors.textMuted,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  empty: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
