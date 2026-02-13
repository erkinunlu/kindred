import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/theme';
import { formatLocationDisplay } from '@/lib/locationUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface UserProfile {
  user_id: string;
  full_name: string;
  bio: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  district?: string | null;
  status: string;
  profile_photos?: string[] | null;
  birth_date?: string | null;
  interests?: string | null;
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const [canView, setCanView] = useState(false);

  useEffect(() => {
    if (!id || !profile?.user_id) return;
    const load = async () => {
      try {
        const { data: prof, error } = await supabase
          .from('profiles')
          .select('user_id, full_name, bio, avatar_url, city, country, district, status, profile_photos, birth_date, interests')
          .eq('user_id', id)
          .single();
        if (error || !prof) {
          setUserProfile(null);
          setCanView(false);
          return;
        }
        const profileVisible = (prof as { profile_visible?: boolean }).profile_visible !== false;
        let friend = false;
        if (id !== profile.user_id) {
          const { data: fr } = await supabase
            .from('friend_requests')
            .select('id')
            .or(`and(from_user_id.eq.${profile.user_id},to_user_id.eq.${id}),and(from_user_id.eq.${id},to_user_id.eq.${profile.user_id})`)
            .eq('status', 'accepted');
          friend = (fr?.length || 0) > 0;
          if (!friend) {
            const { data: fs } = await supabase
              .from('friendships')
              .select('user_id, friend_id')
              .or(`user_id.eq.${profile.user_id},friend_id.eq.${profile.user_id}`);
            const friendIds = new Set(
              (fs || []).flatMap((f) =>
                f.user_id === profile.user_id ? f.friend_id : f.user_id
              )
            );
            friend = friendIds.has(id);
          }
        }
        const visible = id === profile.user_id || profileVisible || friend;
        setUserProfile(prof as UserProfile);
        setIsFriend(friend);
        setCanView(visible);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, profile?.user_id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!userProfile || !canView) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <View style={styles.lockIconWrap}>
            <Ionicons name="lock-closed" size={48} color={colors.primary} />
          </View>
          <Text style={styles.hiddenText}>Bu profil gizli</Text>
          <Text style={styles.hiddenSubtext}>Sadece arkadaşları görebilir</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnProfile = id === profile?.user_id;
  const photos: string[] = [];
  if (userProfile.profile_photos && Array.isArray(userProfile.profile_photos) && userProfile.profile_photos.length > 0) {
    photos.push(...userProfile.profile_photos);
  } else if (userProfile.avatar_url) {
    photos.push(userProfile.avatar_url);
  }

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const d = new Date(birthDate);
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return age;
  };

  const age = getAge(userProfile.birth_date || null);
  const locationStr = formatLocationDisplay(userProfile);
  const interests = userProfile.interests
    ? userProfile.interests.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{userProfile.full_name}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          {photos.length > 0 ? (
            <View style={styles.photosSection}>
              <FlatList
                data={photos}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(_, i) => String(i)}
                getItemLayout={(_, index) => ({
                  length: SCREEN_WIDTH - 32,
                  offset: (SCREEN_WIDTH - 32) * index,
                  index,
                })}
                renderItem={({ item }) => (
                  <Image source={{ uri: item }} style={styles.photoSlide} resizeMode="cover" />
                )}
              />
              {photos.length > 1 && (
                <View style={styles.photoDots}>
                  {photos.map((_, i) => (
                    <View key={i} style={styles.photoDot} />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{userProfile.full_name?.charAt(0) || '?'}</Text>
            </View>
          )}

          <Text style={styles.name}>
            {userProfile.full_name}
            {age != null && `, ${age}`}
          </Text>

          {locationStr ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <Text style={styles.location}>{locationStr}</Text>
            </View>
          ) : null}

          {interests.length > 0 && (
            <View style={styles.interestsRow}>
              {interests.slice(0, 5).map((i, idx) => (
                <View key={idx} style={styles.interestPill}>
                  <Text style={styles.interestText}>{i}</Text>
                </View>
              ))}
            </View>
          )}

          {userProfile.bio ? (
            <Text style={styles.bio}>{userProfile.bio}</Text>
          ) : null}

          {!isOwnProfile && (
            <TouchableOpacity
              style={styles.messageBtn}
              onPress={() => router.push(`/chat/${id}`)}
            >
              <Ionicons name="chatbubble-outline" size={20} color="#fff" />
              <Text style={styles.messageBtnText}>Mesaj Gönder</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fdf2f8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerSpacer: { width: 36 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'center' },
  scroll: { padding: 16, paddingBottom: 32 },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  photosSection: { width: SCREEN_WIDTH - 32, alignSelf: 'center', marginBottom: 20 },
  photoSlide: { width: SCREEN_WIDTH - 32, height: (SCREEN_WIDTH - 32) * 1.2, borderRadius: 12 },
  photoDots: { flexDirection: 'row', gap: 6, marginTop: 12, justifyContent: 'center' },
  photoDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, opacity: 0.5 },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  avatarText: { color: '#fff', fontSize: 48, fontWeight: '600' },
  name: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 8, textAlign: 'center' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 },
  location: { fontSize: 14, color: colors.textMuted },
  interestsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 16 },
  interestPill: {
    backgroundColor: '#fce7f3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fbc2eb',
  },
  interestText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  bio: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
  },
  messageBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lockIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fce7f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  hiddenText: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 4 },
  hiddenSubtext: { fontSize: 14, color: colors.textMuted },
});
