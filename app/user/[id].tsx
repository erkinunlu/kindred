import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface UserProfile {
  user_id: string;
  full_name: string;
  bio: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  status: string;
  profile_photos?: string[] | null;
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
          .select('user_id, full_name, bio, avatar_url, city, country, status, profile_photos')
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
                f.user_id === profile.user_id ? [f.friend_id] : [f.user_id]
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
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!userProfile || !canView) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.centered}>
          <Ionicons name="lock-closed" size={48} color={colors.textMuted} />
          <Text style={styles.hiddenText}>Bu profil gizli</Text>
          <Text style={styles.hiddenSubtext}>Sadece arkadaşları görebilir</Text>
        </View>
      </View>
    );
  }

  const isOwnProfile = id === profile?.user_id;
  const photos: string[] = [];
  if (userProfile.profile_photos && Array.isArray(userProfile.profile_photos) && userProfile.profile_photos.length > 0) {
    photos.push(...userProfile.profile_photos);
  } else if (userProfile.avatar_url) {
    photos.push(userProfile.avatar_url);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{userProfile.full_name}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
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
                  length: SCREEN_WIDTH - 48,
                  offset: (SCREEN_WIDTH - 48) * index,
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
          <Text style={styles.name}>{userProfile.full_name}</Text>
          {(userProfile.city || userProfile.country) && (
            <Text style={styles.location}>
              {[userProfile.city, userProfile.country].filter(Boolean).join(', ')}
            </Text>
          )}
          {userProfile.bio ? <Text style={styles.bio}>{userProfile.bio}</Text> : null}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text, flex: 1 },
  scroll: { padding: 24 },
  profileCard: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  photosSection: { width: SCREEN_WIDTH - 48, alignSelf: 'center', marginBottom: 16 },
  photoSlide: { width: SCREEN_WIDTH - 48, height: (SCREEN_WIDTH - 48) * 1.25, borderRadius: 12 },
  photoDots: { flexDirection: 'row', gap: 6, marginTop: 8 },
  photoDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, opacity: 0.5 },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 16 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '600' },
  name: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 },
  location: { fontSize: 14, color: colors.textMuted, marginBottom: 8 },
  bio: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  messageBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  messageBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hiddenText: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 12 },
  hiddenSubtext: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
});
