import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  PanResponder,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useFilter } from '@/contexts/FilterContext';
import { colors } from '@/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;
const SWIPE_LIMIT = 20;
const SWIPE_WINDOW_HOURS = 24;

interface UserCard {
  user_id: string;
  full_name: string;
  bio: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  birth_date: string | null;
  interests: string | null;
  latitude: number | null;
  longitude: number | null;
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

function formatResetTime(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `bugün ${timeStr}`;
  if (isTomorrow) return `yarın ${timeStr}`;
  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Haversine formülü - km cinsinden mesafe */
function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function DiscoverScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { distanceKm, setDistanceKm } = useFilter();
  const [users, setUsers] = useState<UserCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [filterDistance, setFilterDistance] = useState(distanceKm);

  useEffect(() => {
    if (showFilter) setFilterDistance(distanceKm);
  }, [showFilter, distanceKm]);
  const [matchModal, setMatchModal] = useState<{ name: string; userId: string } | null>(null);
  const position = useRef(new Animated.ValueXY()).current;
  const usersRef = useRef(users);
  const currentIndexRef = useRef(currentIndex);
  usersRef.current = users;
  currentIndexRef.current = currentIndex;

  const fetchUsers = async () => {
    if (!profile?.user_id) return;

    try {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('latitude, longitude')
        .eq('user_id', profile.user_id)
        .single();

      const myLat = myProfile?.latitude ?? 41.0082;
      const myLon = myProfile?.longitude ?? 28.9784;

      const { data: liked } = await supabase
        .from('user_likes')
        .select('liked_user_id')
        .eq('user_id', profile.user_id);
      const likedIds = new Set((liked || []).map((l) => l.liked_user_id));

      const { data: passed } = await supabase
        .from('user_passes')
        .select('passed_user_id')
        .eq('user_id', profile.user_id);
      const passedIds = new Set((passed || []).map((p) => p.passed_user_id));

      const { data: friends } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${profile.user_id},friend_id.eq.${profile.user_id}`);
      const friendIds = new Set(
        (friends || []).flatMap((f) =>
          f.user_id === profile.user_id ? [f.friend_id] : [f.user_id]
        )
      );

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, bio, avatar_url, city, country, birth_date, interests, latitude, longitude')
        .eq('status', 'approved')
        .neq('user_id', profile.user_id)
        .limit(100);

      if (error) {
        setUsers([]);
        return;
      }

      const filtered = (data || [])
        .filter((u) => !likedIds.has(u.user_id) && !passedIds.has(u.user_id) && !friendIds.has(u.user_id))
        .filter((u) => {
          const lat = u.latitude ?? 41.0082;
          const lon = u.longitude ?? 28.9784;
          return distanceKm(myLat, myLon, lat, lon) <= distanceKm;
        });

      setUsers(filtered);
      setCurrentIndex(0);
      position.setValue({ x: 0, y: 0 });
    } catch (err) {
      console.error(err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [profile?.user_id, distanceKm]);

  const checkSwipeLimit = async (): Promise<{ allowed: boolean; resetAt?: Date }> => {
    if (!profile?.user_id) return { allowed: false };
    const since = new Date();
    since.setHours(since.getHours() - SWIPE_WINDOW_HOURS);
    const sinceStr = since.toISOString();
    const { data: recentLikes } = await supabase
      .from('user_likes')
      .select('created_at')
      .eq('user_id', profile.user_id)
      .gte('created_at', sinceStr)
      .order('created_at', { ascending: true })
      .limit(SWIPE_LIMIT + 1);
    const cnt = recentLikes?.length ?? 0;
    if (cnt < SWIPE_LIMIT) return { allowed: true };
    const oldest = recentLikes?.[0]?.created_at;
    const resetAt = oldest
      ? new Date(new Date(oldest).getTime() + SWIPE_WINDOW_HOURS * 60 * 60 * 1000)
      : new Date(since.getTime() + SWIPE_WINDOW_HOURS * 60 * 60 * 1000);
    return { allowed: false, resetAt };
  };

  const showSwipeLimitAlert = (resetAt: Date) => {
    Alert.alert(
      'Beğeni limiti doldu',
      `24 saatte en fazla ${SWIPE_LIMIT} kullanıcı beğenebilirsin. Limitin ${formatResetTime(resetAt)} sıfırlanacak.`,
      [{ text: 'Tamam' }]
    );
  };

  const likeUser = async (userId: string) => {
    if (!profile?.user_id) return;
    const user = users.find((u) => u.user_id === userId);
    try {
      await supabase.from('user_likes').insert({ user_id: profile.user_id, liked_user_id: userId });

      const { data: mutual } = await supabase
        .from('user_likes')
        .select('id')
        .eq('user_id', userId)
        .eq('liked_user_id', profile.user_id)
        .maybeSingle();

      if (mutual) {
        await supabase.from('friendships').upsert(
          [
            { user_id: profile.user_id, friend_id: userId },
            { user_id: userId, friend_id: profile.user_id },
          ],
          { onConflict: 'user_id,friend_id' }
        );
        setMatchModal({ name: user?.full_name || 'Birisi', userId });
      }

      setUsers((prev) => prev.filter((u) => u.user_id !== userId));
      setCurrentIndex((i) => Math.min(i, users.length - 2));
    } catch (err) {
      console.error(err);
    }
  };

  const passUser = async (userId: string) => {
    if (!profile?.user_id) return;
    try {
      await supabase.from('user_passes').insert({ user_id: profile.user_id, passed_user_id: userId });
      setUsers((prev) => prev.filter((u) => u.user_id !== userId));
      setCurrentIndex((i) => Math.min(i, users.length - 2));
    } catch (err) {
      console.error(err);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy * 0.3 });
      },
      onPanResponderRelease: (_, gesture) => {
        const u = usersRef.current;
        const idx = currentIndexRef.current;
        const current = u[idx];
        if (gesture.dx > SWIPE_THRESHOLD && current) {
          checkSwipeLimit().then(({ allowed, resetAt }) => {
            if (!allowed && resetAt) {
              showSwipeLimitAlert(resetAt);
              Animated.spring(position, {
                toValue: { x: 0, y: 0 },
                useNativeDriver: false,
                tension: 50,
                friction: 8,
              }).start();
              return;
            }
            const uid = current.user_id;
            Animated.spring(position, {
              toValue: { x: SCREEN_WIDTH + 100, y: gesture.dy },
              useNativeDriver: false,
              tension: 50,
              friction: 8,
            }).start(() => {
              likeUser(uid);
              position.setValue({ x: 0, y: 0 });
            });
          });
        } else if (gesture.dx < -SWIPE_THRESHOLD && current) {
          Animated.spring(position, {
            toValue: { x: -SCREEN_WIDTH - 100, y: gesture.dy },
            useNativeDriver: false,
            tension: 50,
            friction: 8,
          }).start(() => {
            passUser(current.user_id);
            position.setValue({ x: 0, y: 0 });
          });
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            tension: 50,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  const currentUser = users[currentIndex];

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, SCREEN_WIDTH / 2],
    outputRange: ['-15deg', '15deg'],
    extrapolate: 'clamp',
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const passOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const renderCard = () => {
    if (!currentUser) return null;

    const age = getAge(currentUser.birth_date);
    const location = [currentUser.city, currentUser.country].filter(Boolean).join(', ');
    const interests = currentUser.interests
      ? currentUser.interests.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    return (
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.card,
          {
            transform: [
              { translateX: position.x },
              { translateY: position.y },
              { rotate },
            ],
          },
        ]}
      >
        <Animated.View style={[styles.likeBadge, { opacity: likeOpacity }]}>
          <Text style={styles.likeBadgeText}>BEĞENDİM</Text>
        </Animated.View>
        <Animated.View style={[styles.passBadge, { opacity: passOpacity }]}>
          <Text style={styles.passBadgeText}>GEÇ</Text>
        </Animated.View>

        {currentUser.avatar_url ? (
          <Image source={{ uri: currentUser.avatar_url }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <Text style={styles.placeholderText}>{currentUser.full_name?.charAt(0) || '?'}</Text>
          </View>
        )}

        <View style={styles.cardOverlay}>
          <Text style={styles.cardName}>
            {currentUser.full_name}
            {age != null ? `, ${age}` : ''}
          </Text>
          {location ? <Text style={styles.cardLocation}>{location}</Text> : null}
          {interests.length > 0 && (
            <View style={styles.interestsRow}>
              {interests.slice(0, 5).map((i, idx) => (
                <Text key={idx} style={styles.interestItem}>
                  • {i}
                </Text>
              ))}
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ana Sayfa</Text>
        <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilter(true)}>
          <Ionicons name="options-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      ) : !currentUser ? (
        <View style={styles.centered}>
          <Ionicons name="people-outline" size={80} color={colors.textMuted} />
          <Text style={styles.emptyText}>Şimdilik kimse yok</Text>
          <Text style={styles.emptySubtext}>Filtreleri gevşet veya daha sonra tekrar bak</Text>
        </View>
      ) : (
        <View style={styles.cardContainer}>
          {users[currentIndex + 1] && (
            <View style={[styles.card, styles.cardBehind]}>
              {users[currentIndex + 1].avatar_url ? (
                <Image source={{ uri: users[currentIndex + 1].avatar_url }} style={styles.cardImage} resizeMode="cover" />
              ) : (
                <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                  <Text style={styles.placeholderText}>{users[currentIndex + 1].full_name?.charAt(0) || '?'}</Text>
                </View>
              )}
            </View>
          )}
          {renderCard()}
        </View>
      )}

      {currentUser && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.passBtn]}
            onPress={() => {
              position.setValue({ x: -SCREEN_WIDTH - 100, y: 0 });
              Animated.timing(position, {
                toValue: { x: -SCREEN_WIDTH - 100, y: 0 },
                duration: 200,
                useNativeDriver: false,
              }).start(() => {
                passUser(currentUser.user_id);
                position.setValue({ x: 0, y: 0 });
              });
            }}
          >
            <Ionicons name="close" size={36} color="#ef4444" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.likeBtn]}
            onPress={async () => {
              const { allowed, resetAt } = await checkSwipeLimit();
              if (!allowed && resetAt) {
                showSwipeLimitAlert(resetAt);
                return;
              }
              const uid = currentUser.user_id;
              position.setValue({ x: SCREEN_WIDTH + 100, y: 0 });
              Animated.timing(position, {
                toValue: { x: SCREEN_WIDTH + 100, y: 0 },
                duration: 200,
                useNativeDriver: false,
              }).start(() => {
                likeUser(uid);
                position.setValue({ x: 0, y: 0 });
              });
            }}
          >
            <Ionicons name="heart" size={36} color="#10b981" />
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showFilter} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Kardeş Filtreleri</Text>
              <TouchableOpacity onPress={() => setShowFilter(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.filterCard}>
              <Text style={styles.filterLabel}>Senden Uzaklık</Text>
              <Text style={styles.filterValue}>{filterDistance} kilometre içinde</Text>
              <Slider
                style={styles.slider}
                minimumValue={5}
                maximumValue={200}
                step={5}
                value={filterDistance}
                onValueChange={setFilterDistance}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
            </View>
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => {
                setDistanceKm(filterDistance);
                setShowFilter(false);
                fetchUsers();
              }}
            >
              <Text style={styles.applyBtnText}>Filtreleri Uygula</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!matchModal} transparent animationType="fade">
        <View style={styles.matchOverlay}>
          <View style={styles.matchCard}>
            <Text style={styles.matchEmoji}>🎉</Text>
            <Text style={styles.matchTitle}>Eşleşme!</Text>
            <Text style={styles.matchName}>{matchModal?.name} ile eşleştin</Text>
            <TouchableOpacity
              style={styles.matchMsgBtn}
              onPress={() => {
                setMatchModal(null);
                if (matchModal?.userId) router.push(`/chat/${matchModal.userId}`);
              }}
            >
              <Text style={styles.matchMsgBtnText}>Mesaj Gönder</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.matchCloseBtn} onPress={() => setMatchModal(null)}>
              <Text style={styles.matchCloseText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  filterBtn: { padding: 8 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: colors.textMuted },
  emptyText: { fontSize: 20, fontWeight: '600', color: colors.text, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: colors.textMuted, marginTop: 8 },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    position: 'absolute',
    width: SCREEN_WIDTH - 40,
    height: SCREEN_HEIGHT * 0.65,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  cardBehind: { transform: [{ scale: 0.95 }], opacity: 0.9 },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { fontSize: 80, color: '#fff', fontWeight: '600' },
  likeBadge: {
    position: 'absolute',
    top: 50,
    left: 30,
    zIndex: 10,
    transform: [{ rotate: '-25deg' }],
    borderWidth: 4,
    borderColor: '#10b981',
    padding: 8,
    borderRadius: 8,
  },
  likeBadgeText: { color: '#10b981', fontSize: 28, fontWeight: '800' },
  passBadge: {
    position: 'absolute',
    top: 50,
    right: 30,
    zIndex: 10,
    transform: [{ rotate: '25deg' }],
    borderWidth: 4,
    borderColor: '#ef4444',
    padding: 8,
    borderRadius: 8,
  },
  passBadgeText: { color: '#ef4444', fontSize: 28, fontWeight: '800' },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cardName: { fontSize: 24, fontWeight: '700', color: '#fff' },
  cardLocation: { fontSize: 16, color: '#fff', marginTop: 4, opacity: 0.9 },
  interestsRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  interestItem: { fontSize: 13, color: '#fff', opacity: 0.9 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    paddingBottom: 40,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passBtn: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#ef4444' },
  likeBtn: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#10b981' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  filterTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  filterCard: {
    backgroundColor: '#fafafa',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  filterLabel: { fontSize: 14, color: colors.textMuted, marginBottom: 4 },
  filterValue: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 16 },
  slider: { width: '100%', height: 40 },
  applyBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  applyBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  matchOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: SCREEN_WIDTH - 48,
  },
  matchEmoji: { fontSize: 64, marginBottom: 16 },
  matchTitle: { fontSize: 24, fontWeight: '700', color: colors.text },
  matchName: { fontSize: 18, color: colors.textSecondary, marginTop: 8 },
  matchMsgBtn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  matchMsgBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  matchCloseBtn: { marginTop: 12 },
  matchCloseText: { color: colors.textMuted, fontSize: 14 },
});
