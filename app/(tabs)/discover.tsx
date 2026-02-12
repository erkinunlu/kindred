import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  bio: string | null;
  avatar_url: string | null;
  is_friend?: boolean;
  friend_request_pending?: boolean;
}

interface IncomingRequest {
  id: string;
  from_user_id: string;
  from_user: { full_name: string };
}

export default function DiscoverScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = async () => {
    if (!profile?.user_id) return;

    try {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${profile.user_id},friend_id.eq.${profile.user_id}`);

      const friendIds = new Set(
        (friendships || []).flatMap((f) =>
          f.user_id === profile.user_id ? [f.friend_id] : [f.user_id]
        )
      );

      const { data: pendingRequests } = await supabase
        .from('friend_requests')
        .select('to_user_id')
        .eq('from_user_id', profile.user_id)
        .eq('status', 'pending');

      const pendingIds = new Set(
        (pendingRequests || []).map((r) => r.to_user_id)
      );

      const { data: blocked } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', profile.user_id);
      const blockedSet = new Set((blocked || []).map((b) => b.blocked_id));

      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, bio, avatar_url')
        .eq('status', 'approved')
        .neq('user_id', profile.user_id)
        .limit(50);

      if (error) {
        console.error('Users fetch error:', error);
        setUsers([]);
        return;
      }

      const enriched = (data || [])
        .filter((u) => !blockedSet.has(u.user_id))
        .map((u) => ({
          ...u,
          is_friend: friendIds.has(u.user_id),
          friend_request_pending: pendingIds.has(u.user_id),
        }));

      setUsers(enriched);

      const { data: requests } = await supabase
        .from('friend_requests')
        .select('id, from_user_id')
        .eq('to_user_id', profile.user_id)
        .eq('status', 'pending');
      const fromIds = (requests || []).map((r) => r.from_user_id);
      if (fromIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', fromIds);
        const pmap = new Map((profs || []).map((p) => [p.user_id, p]));
        setIncomingRequests(
          (requests || []).map((r) => ({
            ...r,
            from_user: pmap.get(r.from_user_id) || { full_name: 'Bilinmeyen' },
          }))
        );
      } else {
        setIncomingRequests([]);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const acceptRequest = async (fromUserId: string) => {
    if (!profile?.user_id) return;
    try {
      await supabase.from('friend_requests').update({ status: 'accepted' }).eq('to_user_id', profile.user_id).eq('from_user_id', fromUserId);
      await supabase.from('friendships').insert([
        { user_id: profile.user_id, friend_id: fromUserId },
        { user_id: fromUserId, friend_id: profile.user_id },
      ]);
      setIncomingRequests((prev) => prev.filter((r) => r.from_user_id !== fromUserId));
      fetchUsers();
    } catch (err) {
      console.error('Accept error:', err);
    }
  };

  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());

  const blockUser = async (userId: string) => {
    if (!profile?.user_id) return;
    try {
      await supabase.from('blocks').insert({ blocker_id: profile.user_id, blocked_id: userId });
      setBlockedIds((prev) => new Set(prev).add(userId));
      setUsers((prev) => prev.filter((u) => u.user_id !== userId));
    } catch (err) {
      console.error('Block error:', err);
    }
  };

  const rejectRequest = async (fromUserId: string) => {
    if (!profile?.user_id) return;
    try {
      await supabase.from('friend_requests').update({ status: 'rejected' }).eq('to_user_id', profile.user_id).eq('from_user_id', fromUserId);
      setIncomingRequests((prev) => prev.filter((r) => r.from_user_id !== fromUserId));
    } catch (err) {
      console.error('Reject error:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [profile?.user_id]);

  const sendFriendRequest = async (toUserId: string) => {
    if (!profile?.user_id) return;

    try {
      const { error } = await supabase.from('friend_requests').insert({
        from_user_id: profile.user_id,
        to_user_id: toUserId,
        status: 'pending',
      });

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === toUserId ? { ...u, friend_request_pending: true } : u
        )
      );
    } catch (err) {
      console.error('Friend request error:', err);
    }
  };

  const renderUser = ({ item }: { item: UserProfile }) => (
    <View style={styles.userCard}>
      <View style={styles.avatarPlaceholder}>
        <Text style={styles.avatarText}>
          {item.full_name?.charAt(0)?.toUpperCase() || '?'}
        </Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.full_name}</Text>
        {item.bio ? (
          <Text style={styles.userBio} numberOfLines={2}>
            {item.bio}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        {!item.is_friend && !item.friend_request_pending && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => sendFriendRequest(item.user_id)}
          >
            <Text style={styles.addButtonText}>Ekle</Text>
          </TouchableOpacity>
        )}
        {item.friend_request_pending && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>Beklemede</Text>
          </View>
        )}
        {item.is_friend && (
          <View style={styles.friendBadge}>
            <Text style={styles.friendText}>Arkadaş</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.messageButton}
          onPress={() => router.push(`/chat/${item.user_id}`)}
        >
          <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() =>
            Alert.alert(
              'Engelle',
              `${item.full_name} kullanıcısını engellemek istediğinize emin misiniz?`,
              [
                { text: 'İptal', style: 'cancel' },
                { text: 'Engelle', style: 'destructive', onPress: () => blockUser(item.user_id) },
              ]
            )
          }
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {incomingRequests.length > 0 && (
        <View style={styles.incomingSection}>
          <Text style={styles.incomingTitle}>Arkadaşlık İstekleri</Text>
          {incomingRequests.map((r) => (
            <View key={r.id} style={styles.requestCard}>
              <Text style={styles.requestName}>{r.from_user.full_name}</Text>
              <View style={styles.requestActions}>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptRequest(r.from_user_id)}>
                  <Text style={styles.acceptBtnText}>Kabul</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectRequest(r.from_user_id)}>
                  <Text style={styles.rejectBtnText}>Reddet</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Henüz kullanıcı bulunamadı</Text>
              <Text style={styles.emptySubtext}>
                Onaylanmış profiller burada görünecek
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchUsers} />
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
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  userBio: {
    fontSize: 14,
    color: '#6b7280',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  messageButton: {
    padding: 8,
  },
  moreButton: {
    padding: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  pendingBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fef3c7',
  },
  pendingText: {
    fontSize: 12,
    color: '#92400e',
  },
  friendBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#d1fae5',
  },
  friendText: {
    fontSize: 12,
    color: '#065f46',
  },
  incomingSection: {
    padding: 16,
    paddingBottom: 0,
  },
  incomingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rejectBtnText: {
    color: '#6b7280',
    fontSize: 14,
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
});
