import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  PanResponder,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import Slider from '@react-native-community/slider';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useFilter } from '@/contexts/FilterContext';
import { colors } from '@/constants/theme';
import { formatLocationDisplay } from '@/lib/locationUtils';

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
  district?: string | null;
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

const INTEREST_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  müzik: 'musical-notes',
  music: 'musical-notes',
  pizza: 'pizza',
  seyahat: 'airplane',
  travel: 'airplane',
  kitap: 'book',
  book: 'book',
  spor: 'bicycle',
  sport: 'bicycle',
  kahve: 'cafe',
  coffee: 'cafe',
  yemek: 'restaurant',
  food: 'restaurant',
  sinema: 'film',
  film: 'film',
};

/** Haversine formülü - km cinsinden mesafe */
function haversineKm(
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
  const navigation = useNavigation();
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
  const [myCoords, setMyCoords] = useState<{ lat: number; lon: number }>({ lat: 41.0082, lon: 28.9784 });
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
      setMyCoords({ lat: myLat, lon: myLon });

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
        .select('user_id, full_name, bio, avatar_url, city, country, district, birth_date, interests, latitude, longitude')
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
          return haversineKm(myLat, myLon, lat, lon) <= distanceKm;
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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => setShowFilter(true)} style={{ padding: 8 }}>
          <Ionicons name="filter" size={24} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

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
      setCurrentIndex(0);
    } catch (err) {
      console.error(err);
    }
  };

  const passUser = async (userId: string) => {
    if (!profile?.user_id) return;
    try {
      await supabase.from('user_passes').insert({ user_id: profile.user_id, passed_user_id: userId });
      setUsers((prev) => prev.filter((u) => u.user_id !== userId));
      setCurrentIndex(0);
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
              position.setValue({ x: 0, y: 0 });
              likeUser(uid);
            });
          });
        } else if (gesture.dx < -SWIPE_THRESHOLD && current) {
          Animated.spring(position, {
            toValue: { x: -SCREEN_WIDTH - 100, y: gesture.dy },
            useNativeDriver: false,
            tension: 50,
            friction: 8,
          }).start(() => {
            position.setValue({ x: 0, y: 0 });
            passUser(current.user_id);
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

  const renderCard = () => {
    if (!currentUser) return null;

    const age = getAge(currentUser.birth_date);
    const locationStr = formatLocationDisplay(currentUser);
    const distKm = haversineKm(
      myCoords.lat,
      myCoords.lon,
      currentUser.latitude ?? 41.0082,
      currentUser.longitude ?? 28.9784
    );
    const locationDisplay = locationStr
      ? `${locationStr}, ${Math.round(distKm)}km uzaklıkta`
      : `${Math.round(distKm)}km uzaklıkta`;
    const interests = currentUser.interests
      ? currentUser.interests.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    return (
      <Animated.View
        key={currentUser.user_id}
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
        {currentUser.avatar_url ? (
          <Image source={{ uri: currentUser.avatar_url }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <Text style={styles.placeholderText}>{currentUser.full_name?.charAt(0) || '?'}</Text>
          </View>
        )}

        <View style={styles.cardOverlay}>
          <View style={styles.cardNameRow}>
            <Text style={styles.cardName}>
              {currentUser.full_name}
              {age != null ? `, ${age}` : ''}
            </Text>
            <View style={styles.onlineDot} />
          </View>
          {locationDisplay ? (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.cardLocation}>{locationDisplay}</Text>
            </View>
          ) : null}
          {interests.length > 0 && (
            <View style={styles.interestsRow}>
              {interests.slice(0, 5).map((i, idx) => {
                const icon = INTEREST_ICONS[i.toLowerCase()] || 'heart';
                return (
                  <View key={idx} style={styles.interestPill}>
                    <Ionicons name={icon} size={14} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={styles.interestItem}>{i}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
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
        <View style={styles.mainContent}>
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
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionBtnPass} onPress={() => currentUser && passUser(currentUser.user_id)}>
              <Ionicons name="close" size={32} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtnSuperLike}
              onPress={() => {
                if (currentUser) {
                  checkSwipeLimit().then(({ allowed, resetAt }) => {
                    if (!allowed && resetAt) showSwipeLimitAlert(resetAt);
                    else likeUser(currentUser.user_id);
                  });
                }
              }}
            >
              <Ionicons name="star" size={28} color="#3B82F6" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtnLike}
              onPress={() => {
                if (currentUser) {
                  checkSwipeLimit().then(({ allowed, resetAt }) => {
                    if (!allowed && resetAt) showSwipeLimitAlert(resetAt);
                    else likeUser(currentUser.user_id);
                  });
                }
              }}
            >
              <Ionicons name="heart" size={32} color="#fff" />
            </TouchableOpacity>
          </View>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: colors.textMuted },
  emptyText: { fontSize: 20, fontWeight: '600', color: colors.text, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: colors.textMuted, marginTop: 8 },
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { fontSize: 24, fontWeight: '700', color: '#fff' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cardLocation: { fontSize: 15, color: '#fff', opacity: 0.95 },
  interestsRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  interestItem: { fontSize: 13, color: '#fff', fontWeight: '500' },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingVertical: 24,
    paddingBottom: 32,
  },
  actionBtnPass: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionBtnSuperLike: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionBtnLike: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
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
