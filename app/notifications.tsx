import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, fonts } from '@/constants/theme';

interface Notification {
  id: string;
  type: 'message' | 'match' | 'like' | 'comment';
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  from_user_id: string | null;
  post_id: string | null;
  read_at: string | null;
  created_at: string;
  from_profile?: { full_name: string; avatar_url: string | null };
}

const TYPE_ICONS = {
  message: 'chatbubble' as const,
  match: 'heart' as const,
  like: 'heart' as const,
  comment: 'chatbubble-outline' as const,
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins} dk önce`;
  if (hours < 24) return `${hours} sa önce`;
  if (days < 7) return `${days} gün önce`;
  return d.toLocaleDateString('tr-TR');
}

export default function NotificationsScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!profile?.user_id) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, data, from_user_id, post_id, read_at, created_at')
        .eq('user_id', profile.user_id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const fromIds = [...new Set((data || []).map((n) => n.from_user_id).filter(Boolean))] as string[];
      const { data: profs } = fromIds.length
        ? await supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', fromIds)
        : { data: [] };
      const pmap = new Map((profs || []).map((p) => [p.user_id, p]));
      setNotifications(
        (data || []).map((n) => ({
          ...n,
          from_profile: n.from_user_id ? pmap.get(n.from_user_id) : undefined,
        }))
      );
    } catch (err) {
      console.error('Notifications fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.user_id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    } catch (e) {
      console.warn('Mark read error:', e);
    }
  };

  const handleNotificationPress = (n: Notification) => {
    markAsRead(n.id);
    if (n.type === 'message' && n.data?.chatUserId) {
      router.push(`/chat/${n.data.chatUserId}`);
    } else if (n.type === 'match' && n.data?.matchUserId) {
      router.push(`/chat/${n.data.matchUserId}`);
    } else if ((n.type === 'like' || n.type === 'comment') && n.post_id) {
      router.push(`/post/${n.post_id}`);
    }
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notifRow, !item.read_at && styles.notifUnread]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.notifIconWrap}>
        {item.from_profile?.avatar_url ? (
          <Image source={{ uri: item.from_profile.avatar_url }} style={styles.notifAvatar} />
        ) : (
          <View style={[styles.notifAvatar, styles.avatarPlaceholder]}>
            <Ionicons name={TYPE_ICONS[item.type]} size={24} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.notifContent}>
        <Text style={styles.notifTitle} numberOfLines={1}>{item.title}</Text>
        {item.body ? <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text> : null}
        <Text style={styles.notifTime}>{formatDate(item.created_at)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  if (loading && notifications.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Bildirimler yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyText}>Henüz bildirim yok</Text>
            <Text style={styles.emptySubtext}>Mesaj, eşleşme veya etkileşimler burada görünecek</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(); }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: colors.textMuted },
  list: { padding: 16, paddingBottom: 32 },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  notifUnread: { backgroundColor: '#fef2f2' },
  notifIconWrap: { marginRight: 12 },
  notifAvatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  notifBody: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  notifTime: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: colors.textMuted, marginTop: 8 },
});
