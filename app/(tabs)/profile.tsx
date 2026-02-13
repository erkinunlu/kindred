import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Text } from '@/components/Text';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { uriToArrayBuffer, base64ToArrayBufferFromPicker } from '@/lib/uploadUtils';
import { colors, fonts } from '@/constants/theme';
import { formatLocationDisplay } from '@/lib/locationUtils';

const LIGHT_PINK = '#FCE4EC';
const ICON_BLUE = '#64B5F6';

function getProfileCompletion(profile: { full_name?: string; bio?: string | null; avatar_url?: string | null; city?: string | null; country?: string | null; interests?: string | null; latitude?: number | null; longitude?: number | null; instagram?: string | null; twitter?: string | null; facebook?: string | null } | null): number {
  if (!profile) return 0;
  let filled = 0;
  const total = 8;
  if (profile.full_name?.trim()) filled++;
  if (profile.avatar_url) filled++;
  if (profile.bio?.trim()) filled++;
  if (profile.city?.trim()) filled++;
  if (profile.country?.trim()) filled++;
  if (profile.interests?.trim()) filled++;
  if (profile.latitude != null && profile.longitude != null) filled++;
  if (profile.instagram || profile.twitter || profile.facebook) filled++;
  return Math.min(100, Math.round((filled / total) * 100));
}

function MenuItem({
  icon,
  iconColor,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIconWrap, iconColor && { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={icon} size={22} color={iconColor || colors.textMuted} />
      </View>
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, session, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [city, setCity] = useState(profile?.city || '');
  const [country, setCountry] = useState(profile?.country || '');
  const [instagram, setInstagram] = useState(profile?.instagram || '');
  const [twitter, setTwitter] = useState(profile?.twitter || '');
  const [facebook, setFacebook] = useState(profile?.facebook || '');
  const [website, setWebsite] = useState(profile?.website || '');
  const [interests, setInterests] = useState(profile?.interests || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [profilePhotos, setProfilePhotos] = useState<string[]>([]);
  const [profilePhotosLocal, setProfilePhotosLocal] = useState<{ uri: string; base64?: string }[]>([]);
  const [profileVisible, setProfileVisible] = useState(profile?.profile_visible !== false);
  const [saving, setSaving] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [birthDate, setBirthDate] = useState<Date>(() => {
    if (profile?.birth_date) {
      const d = new Date(profile.birth_date);
      return isNaN(d.getTime()) ? new Date(1996, 10, 19) : d;
    }
    return new Date(1996, 10, 19);
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [friendshipType, setFriendshipType] = useState(profile?.friendship_type || '');
  const [hangoutFrequency, setHangoutFrequency] = useState(profile?.hangout_frequency || '');
  const [languages, setLanguages] = useState(profile?.languages || '');

  const completion = getProfileCompletion(profile);

  const FRIENDSHIP_OPTIONS = ['En İyi Arkadaş 1:1', 'Grup arkadaşlığı', 'Spor arkadaşı', 'Kahve arkadaşı', 'Yemek arkadaşı'];
  const FREQUENCY_OPTIONS = ['Spontan', 'Haftalık', 'İki haftada bir', 'Aylık'];
  const email = session?.user?.email || '';

  const getDeviceLocation = async () => {
    if (!profile?.user_id) return;
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Konum izni gerekli',
          'Yakındaki kullanıcıları gösterebilmek için konum erişimine izin vermeniz gerekiyor. Lütfen ayarlardan izin verin.'
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      let district: string | null = null;
      let city: string | null = null;
      let country: string | null = null;
      try {
        const [addr] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        district = addr?.district ?? null;
        city = addr?.subregion ?? addr?.city ?? null;
        country = addr?.country ?? null;
      } catch {
        // reverse geocode başarısız olursa sadece koordinatları kaydet
      }
      const { error } = await supabase
        .from('profiles')
        .update({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          district: district || profile?.district,
          city: city || profile?.city,
          country: country || profile?.country,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', profile.user_id);
      if (error) throw error;
      await refreshProfile();
      Alert.alert('Başarılı', 'Konumunuz kaydedildi.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Konum alınamadı.';
      Alert.alert('Hata', String(msg));
    } finally {
      setLocationLoading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin gerekli', 'Fotoğraf seçmek için galeri izni gereklidir.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setAvatarBase64(result.assets[0].base64 ?? null);
    }
  };

  const handleSave = async () => {
    if (!profile?.user_id) return;
    if (!fullName.trim()) {
      Alert.alert('Hata', 'Ad Soyad boş olamaz.');
      return;
    }

    setSaving(true);
    try {
      let avatarUrl = profile?.avatar_url;

      if (avatarUri) {
        const fileName = `${profile.user_id}/avatar_${Date.now()}.jpg`;
        let arrayBuffer: ArrayBuffer;
        if (avatarBase64) {
          arrayBuffer = base64ToArrayBufferFromPicker(avatarBase64);
        } else {
          arrayBuffer = await uriToArrayBuffer(avatarUri);
        }
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, arrayBuffer, { upsert: true, contentType: 'image/jpeg' });
        if (uploadError) {
          console.error('Avatar upload error:', uploadError);
          Alert.alert('Hata', 'Profil fotoğrafı yüklenemedi: ' + (uploadError.message || 'Bilinmeyen hata'));
        } else {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
          avatarUrl = urlData?.publicUrl || null;
        }
      }

      const photosUrls: string[] = [];
      for (let i = 0; i < 2; i++) {
        if (profilePhotosLocal[i]) {
          const p = profilePhotosLocal[i];
          const fileName = `${profile.user_id}/photo_${Date.now()}_${i}.jpg`;
          let arrayBuffer: ArrayBuffer;
          if (p.base64) {
            arrayBuffer = base64ToArrayBufferFromPicker(p.base64);
          } else {
            arrayBuffer = await uriToArrayBuffer(p.uri);
          }
          const { error: upErr } = await supabase.storage
            .from('avatars')
            .upload(fileName, arrayBuffer, { upsert: true, contentType: 'image/jpeg' });
          if (!upErr) {
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
            photosUrls.push(urlData.publicUrl);
          }
        } else if (profilePhotos[i]) {
          photosUrls.push(profilePhotos[i]);
        }
      }
      const mainUrl = avatarUrl || profile?.avatar_url;
      const allPhotos = mainUrl ? [mainUrl, ...photosUrls] : photosUrls;

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          bio: bio.trim() || null,
          city: city.trim() || null,
          country: country.trim() || null,
          instagram: instagram.trim() || null,
          twitter: twitter.trim() || null,
          facebook: facebook.trim() || null,
          website: website.trim() || null,
          avatar_url: avatarUrl,
          profile_visible: profileVisible,
          interests: interests.trim() || null,
          birth_date: birthDate.toISOString().split('T')[0],
          friendship_type: friendshipType.trim() || null,
          hangout_frequency: hangoutFrequency.trim() || null,
          languages: languages.trim() || null,
          profile_photos: allPhotos.length > 0 ? allPhotos : null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', profile.user_id);

      if (error) throw error;
      await refreshProfile();
      setEditing(false);
      setAvatarUri(null);
      setAvatarBase64(null);
      setProfilePhotosLocal([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Profil güncellenemedi.';
      Alert.alert('Hata', String(msg));
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    setAvatarBase64(null);
    setAvatarUri(null);
    setProfilePhotosLocal([]);
    setProfileVisible(profile?.profile_visible !== false);
    setFullName(profile?.full_name || '');
    setBio(profile?.bio || '');
    setCity(profile?.city || '');
    setCountry(profile?.country || '');
    setInstagram(profile?.instagram || '');
    setTwitter(profile?.twitter || '');
    setFacebook(profile?.facebook || '');
    setWebsite(profile?.website || '');
    setInterests(profile?.interests || '');
    setFriendshipType(profile?.friendship_type || '');
    setHangoutFrequency(profile?.hangout_frequency || '');
    setLanguages(profile?.languages || '');
    if (profile?.birth_date) {
      const d = new Date(profile.birth_date);
      setBirthDate(isNaN(d.getTime()) ? new Date(1996, 10, 19) : d);
    } else {
      setBirthDate(new Date(1996, 10, 19));
    }
    const existingPhotos = (profile as { profile_photos?: string[] })?.profile_photos || [];
    setProfilePhotos(existingPhotos.length > 1 ? existingPhotos.slice(1) : []);
    setEditing(true);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header: Avatar */}
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            <TouchableOpacity style={styles.avatarButton} onPress={editing ? pickImage : undefined}>
              {(avatarUri || profile?.avatar_url) ? (
                <Image
                  key={avatarUri || profile?.avatar_url || 'avatar'}
                  source={{ uri: avatarUri || profile?.avatar_url || '' }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {fullName?.charAt(0)?.toUpperCase() || profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Completion badge */}
        <View style={styles.badgeWrap}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{completion}% Tamamlandı</Text>
          </View>
        </View>

        {/* Name & Email */}
        <Text style={styles.name}>{profile?.full_name || 'Profil'}</Text>
        {email ? <Text style={styles.email}>{email}</Text> : null}

        {/* Menu items */}
        <View style={styles.menu}>
          <MenuItem
            icon="document-text-outline"
            iconColor={ICON_BLUE}
            label="Profili Düzenle"
            onPress={startEditing}
          />
          <MenuItem
            icon="settings-outline"
            iconColor={ICON_BLUE}
            label="Ayarlar"
            onPress={() => router.push('/(tabs)/settings')}
          />
          <MenuItem
            icon="help-circle-outline"
            iconColor={colors.primary}
            label="Yardım ve Destek"
            onPress={() => Alert.alert('Yardım', 'Yakında burada yardım olacak.')}
          />
          <MenuItem
            icon="document-text-outline"
            iconColor={ICON_BLUE}
            label="Koşullar ve Gizlilik"
            onPress={() => Alert.alert('Koşullar', 'Yakında burada koşullar olacak.')}
          />
          <MenuItem
            icon="log-out-outline"
            iconColor="#8D6E63"
            label="Çıkış Yap"
            onPress={() => {
              Alert.alert('Çıkış Yap', 'Çıkış yapmak istediğinize emin misiniz?', [
                { text: 'İptal', style: 'cancel' },
                { text: 'Çıkış yap', style: 'destructive', onPress: signOut },
              ]);
            }}
            danger
          />
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editing} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 12) }]}>
            <TouchableOpacity onPress={() => setEditing(false)} style={styles.modalBackBtn}>
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Profili Düzenle</Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[styles.kaydetBtn, saving && styles.disabled]}
            >
              <Text style={styles.kaydetBtnText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
            {/* Fotoğraflar */}
            <View style={styles.photosGrid}>
              <TouchableOpacity style={styles.photoMain} onPress={pickImage}>
                {(avatarUri || profile?.avatar_url) ? (
                  <Image source={{ uri: avatarUri || profile?.avatar_url || '' }} style={styles.photoImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.photoImg, styles.photoPlaceholder]}>
                    <Ionicons name="add" size={32} color={colors.textMuted} />
                  </View>
                )}
                {(avatarUri || profile?.avatar_url) && (
                  <TouchableOpacity style={styles.photoRemove} onPress={() => { setAvatarUri(null); setAvatarBase64(null); }}>
                    <Ionicons name="close" size={18} color={colors.white} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              <View style={styles.photosSmall}>
                {[0, 1].map((i) => {
                  const src = profilePhotosLocal[i]?.uri || profilePhotos[i] || (profile as { profile_photos?: string[] })?.profile_photos?.[i + 1];
                  return (
                    <TouchableOpacity
                      key={i}
                      style={styles.photoSmall}
                      onPress={async () => {
                        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                        if (status !== 'granted') return;
                        const r = await ImagePicker.launchImageLibraryAsync({
                          mediaTypes: ImagePicker.MediaTypeOptions.Images,
                          allowsEditing: true,
                          aspect: [1, 1],
                          quality: 0.8,
                          base64: true,
                        });
                        if (!r.canceled && r.assets[0]) {
                          setProfilePhotosLocal((prev) => {
                            const n = [...prev];
                            n[i] = { uri: r.assets[0].uri, base64: r.assets[0].base64 ?? undefined };
                            return n;
                          });
                        }
                      }}
                    >
                      {src ? (
                        <>
                          <Image source={{ uri: src }} style={styles.photoImg} resizeMode="cover" />
                          <TouchableOpacity
                            style={[styles.photoRemove, styles.photoRemoveSmall]}
                            onPress={() => {
                              setProfilePhotosLocal((p) => p.filter((_, j) => j !== i));
                              setProfilePhotos((p) => p.filter((_, j) => j !== i));
                            }}
                          >
                            <Ionicons name="close" size={14} color={colors.white} />
                          </TouchableOpacity>
                        </>
                      ) : (
                        <View style={[styles.photoImg, styles.photoPlaceholder]}>
                          <Ionicons name="add" size={24} color={colors.textMuted} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Ad Soyad */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Ad Soyad</Text>
              <TextInput
                style={styles.cardInput}
                placeholder="Adınız ve soyadınız"
                placeholderTextColor={colors.textMuted}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            {/* Açıklama */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Açıklama</Text>
              <TextInput
                style={styles.cardInput}
                placeholder="Kendinden bahset..."
                placeholderTextColor={colors.textMuted}
                value={bio}
                onChangeText={setBio}
                multiline
              />
            </View>

            {/* Doğum Tarihi */}
            <TouchableOpacity style={styles.card} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.cardLabel}>Doğum Tarihi</Text>
              <View style={styles.cardRow}>
                <Text style={styles.cardValue}>{birthDate.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </View>
            </TouchableOpacity>

            {/* Arkadaşlık Tipi */}
            <TouchableOpacity
              style={styles.card}
              onPress={() => {
                Alert.alert('Arkadaşlık Tipi', 'Seçiniz', [
                  ...FRIENDSHIP_OPTIONS.map((opt) => ({ text: opt, onPress: () => setFriendshipType(opt) })),
                  { text: 'İptal', style: 'cancel' },
                ]);
              }}
            >
              <Text style={styles.cardLabel}>Arkadaşlık Tipi</Text>
              <View style={styles.cardRow}>
                <Text style={[styles.cardValue, !friendshipType && styles.cardValuePlaceholder]}>
                  {friendshipType || 'Seçiniz'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </View>
            </TouchableOpacity>

            {/* Ne sıklıkla takılmak istiyorsun? */}
            <TouchableOpacity
              style={styles.card}
              onPress={() => {
                Alert.alert('Ne sıklıkla takılmak istiyorsun?', 'Seçiniz', [
                  ...FREQUENCY_OPTIONS.map((opt) => ({ text: opt, onPress: () => setHangoutFrequency(opt) })),
                  { text: 'İptal', style: 'cancel' },
                ]);
              }}
            >
              <Text style={styles.cardLabel}>Ne sıklıkla takılmak istiyorsun?</Text>
              <View style={styles.cardRow}>
                <Text style={[styles.cardValue, !hangoutFrequency && styles.cardValuePlaceholder]}>
                  {hangoutFrequency || 'Seçiniz'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </View>
            </TouchableOpacity>

            {/* İlgi Alanları */}
            <View style={styles.card}>
              <View style={styles.cardLabelRow}>
                <Text style={styles.cardLabel}>İlgi Alanları</Text>
                <Text style={styles.cardHint}>maks 5</Text>
              </View>
              <TextInput
                style={styles.cardInput}
                placeholder="Kahve buluşmaları, Kitap kulübü, Şehir yürüyüşleri..."
                placeholderTextColor={colors.textMuted}
                value={interests}
                onChangeText={(t) => {
                  const parts = t.split(',').map((s) => s.trim()).filter(Boolean);
                  if (parts.length <= 5) setInterests(t);
                  else setInterests(parts.slice(0, 5).join(', '));
                }}
              />
            </View>

            {/* Diller */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Diller</Text>
              <TextInput
                style={styles.cardInput}
                placeholder="Turkish, English..."
                placeholderTextColor={colors.textMuted}
                value={languages}
                onChangeText={setLanguages}
              />
            </View>

            {/* Konum */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Konum</Text>
              <TouchableOpacity
                style={[styles.locationButtonCard, locationLoading && styles.disabled]}
                onPress={getDeviceLocation}
                disabled={locationLoading}
              >
                {locationLoading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="location" size={20} color={colors.white} style={{ marginRight: 8 }} />
                    <Text style={styles.locationButtonText}>
                      {profile?.latitude != null && profile?.longitude != null ? 'Konumumu Güncelle' : 'Konumumu Seç'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Profili herkese açık göster</Text>
              <Switch
                value={profileVisible}
                onValueChange={setProfileVisible}
                trackColor={{ false: colors.border, true: colors.primary + '80' }}
                thumbColor={profileVisible ? colors.primary : '#f4f3f4'}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {showDatePicker && (
          <DateTimePicker
            value={birthDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, d) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (d) setBirthDate(d);
            }}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  avatarWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarButton: {
    padding: 4,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
  },
  avatarText: {
    color: colors.white,
    fontSize: 48,
    fontWeight: '600',
  },
  badgeWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  menu: {
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LIGHT_PINK,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: ICON_BLUE + '20',
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  menuLabelDanger: {
    color: colors.error,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  modalBackBtn: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  kaydetBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  kaydetBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 48,
    backgroundColor: '#FDF2F4',
  },
  photosGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  photoMain: {
    flex: 2,
    aspectRatio: 0.85,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: LIGHT_PINK,
    backgroundColor: LIGHT_PINK,
  },
  photosSmall: {
    flex: 1,
    gap: 8,
  },
  photoSmall: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: LIGHT_PINK,
    backgroundColor: LIGHT_PINK,
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    top: 4,
    right: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  cardLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  cardInput: {
    fontSize: 16,
    color: colors.text,
    padding: 0,
    minHeight: 24,
    textAlignVertical: 'top',
    fontFamily: fonts.regular,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardValue: {
    fontSize: 16,
    color: colors.text,
  },
  cardValuePlaceholder: {
    color: colors.textMuted,
  },
  input: {
    width: '100%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    color: colors.text,
    fontFamily: fonts.regular,
  },
  bioInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
  },
  settingTextWrap: { flex: 1 },
  settingLabel: {
    fontSize: 16,
    color: colors.text,
  },
  settingHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  disabled: {
    opacity: 0.7,
  },
  locationSection: {
    marginBottom: 20,
  },
  locationLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  locationHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  locationButtonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  locationButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  locationStatus: {
    fontSize: 13,
    color: colors.primary,
    marginTop: 8,
  },
});
