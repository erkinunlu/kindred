import { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text } from '@/components/Text';
import { colors } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Conversation {
  id: string;
  participant: {
    full_name: string;
    avatar_url: string | null;
  };
  last_message?: string;
  last_message_at?: string;
}

export default function MessagesScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConversations = async () => {
      if (!profile?.user_id) return;

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
        const lastByUser: Record<string, { content: string; date: string }> = {};

        (dmData || []).forEach((dm) => {
          const other =
            dm.sender_id === profile.user_id ? dm.receiver_id : dm.sender_id;
          otherUserIds.add(other);
          if (!lastByUser[other] || dm.created_at > lastByUser[other].date) {
            lastByUser[other] = { content: dm.content, date: dm.created_at };
          }
        });

        if (otherUserIds.size === 0) {
          setConversations([]);
          setLoading(false);
          return;
        }

        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', Array.from(otherUserIds));

        const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

        const convos: Conversation[] = Array.from(otherUserIds)
          .filter((uid) => !blockedSet.has(uid))
          .map((uid) => {
            const p = profileMap.get(uid);
            const last = lastByUser[uid];
            return {
              id: uid,
              participant: {
                full_name: p?.full_name || 'Bilinmeyen',
                avatar_url: p?.avatar_url || null,
              },
              last_message: last?.content,
              last_message_at: last?.date,
            };
          });

        convos.sort((a, b) => {
          const da = a.last_message_at || '';
          const db = b.last_message_at || '';
          return db.localeCompare(da);
        });

        setConversations(convos);
      } catch (err) {
        console.error('Messages fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [profile?.user_id]);

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.conversationCard}
            onPress={() => router.push(`/chat/${item.id}`)}
          >
            {item.participant.avatar_url ? (
              <Image
                source={{ uri: item.participant.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {item.participant.full_name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.conversationInfo}>
              <Text style={styles.conversationName}>
                {item.participant.full_name}
              </Text>
              {item.last_message ? (
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.last_message}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Henüz mesaj yok</Text>
              <Text style={styles.emptySubtext}>
                Arkadaş ekleyip sohbet başlattığında mesajlar burada görünecek
              </Text>
            </View>
          ) : null
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
  conversationCard: {
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
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
  conversationInfo: {
    flex: 1,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  lastMessage: {
    fontSize: 14,
    color: '#6b7280',
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
