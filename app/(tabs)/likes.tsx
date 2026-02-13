import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LikeUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  birth_date: string | null;
}

function getAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function UserCard({
  user,
  onPress,
}: {
  user: LikeUser;
  onPress: () => void;
}) {
  const age = getAge(user.birth_date);
  const location = [user.city, user.country].filter(Boolean).join(', ');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {user.avatar_url ? (
        <Image source={{ uri: user.avatar_url }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Text style={styles.placeholderText}>{user.full_name?.charAt(0) || '?'}</Text>
        </View>
      )}
      <View style={styles.cardOverlay}>
        <Text style={styles.cardName}>
          {user.full_name}
          {age != null ? `, ${age}` : ''}
        </Text>
        {location ? <Text style={styles.cardLocation}>{location}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export default function LikesScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'matches' | 'liked_you'>('matches');
  const [matches, setMatches] = useState<LikeUser[]>([]);
  const [likedYou, setLikedYou] = useState<LikeUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = async () => {
    if (!profile?.user_id) return [];
    const { data: friends } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${profile.user_id},friend_id.eq.${profile.user_id}`);
    const friendIds = (friends || []).map((f) =>
      f.user_id === profile.user_id ? f.friend_id : f.user_id
    );
    if (friendIds.length === 0) return [];
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url, city, country, birth_date')
      .in('user_id', friendIds)
      .eq('status', 'approved');
    return data || [];
  };

  const fetchLikedYou = async () => {
    if (!profile?.user_id) return [];
    const { data: likes } = await supabase
      .from('user_likes')
      .select('user_id')
      .eq('liked_user_id', profile.user_id);
    const likerIds = (likes || []).map((l) => l.user_id);
    if (likerIds.length === 0) return [];
    const { data: friends } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${profile.user_id},friend_id.eq.${profile.user_id}`);
    const friendIds = new Set(
      (friends || []).flatMap((f) =>
        f.user_id === profile.user_id ? [f.friend_id] : [f.user_id]
      )
    );
    const notYetMatched = likerIds.filter((id) => !friendIds.has(id));
    if (notYetMatched.length === 0) return [];
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url, city, country, birth_date')
      .in('user_id', notYetMatched)
      .eq('status', 'approved');
    return data || [];
  };

  const load = async () => {
    if (!profile?.user_id) return;
    setLoading(true);
    try {
      const [m, l] = await Promise.all([fetchMatches(), fetchLikedYou()]);
      setMatches(m);
      setLikedYou(l);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [profile?.user_id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [profile?.user_id])
  );

  const matchesCount = matches.length;
  const likedYouCount = likedYou.length;

  const list = activeTab === 'matches' ? matches : likedYou;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Beğeniler</Text>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'matches' && styles.tabActive]}
          onPress={() => setActiveTab('matches')}
        >
          <Text style={[styles.tabText, activeTab === 'matches' && styles.tabTextActive]}>
            Eşleşmeler
          </Text>
          {matchesCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{matchesCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'liked_you' && styles.tabActive]}
          onPress={() => setActiveTab('liked_you')}
        >
          <Text style={[styles.tabText, activeTab === 'liked_you' && styles.tabTextActive]}>
            Seni beğenenler
          </Text>
          {likedYouCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{likedYouCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons
            name={activeTab === 'matches' ? 'heart-outline' : 'heart'}
            size={64}
            color={colors.textMuted}
          />
          <Text style={styles.emptyText}>
            {activeTab === 'matches'
              ? 'Henüz eşleşme yok'
              : 'Seni beğenen kimse yok'}
          </Text>
          <Text style={styles.emptySubtext}>
            {activeTab === 'matches'
              ? 'Ana sayfada kullanıcıları beğenerek eşleşebilirsin'
              : 'Profilini güncelleyerek daha fazla beğeni alabilirsin'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {list.map((user) => (
            <UserCard
              key={user.user_id}
              user={user}
              onPress={() => router.push(`/user/${user.user_id}`)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 24,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: -1,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  card: {
    width: '100%',
    aspectRatio: 0.75,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.white,
    fontSize: 48,
    fontWeight: '600',
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cardName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
  },
  cardLocation: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
});
