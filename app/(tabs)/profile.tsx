import { useState } from 'react';
import {
  View,
  Text,
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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { uriToArrayBuffer, base64ToArrayBufferFromPicker } from '@/lib/uploadUtils';
import { colors } from '@/constants/theme';

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
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
  const [profileVisible, setProfileVisible] = useState(profile?.profile_visible !== false);
  const [saving, setSaving] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

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
      const { error } = await supabase
        .from('profiles')
        .update({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
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
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', profile.user_id);

      if (error) throw error;
      await refreshProfile();
      setEditing(false);
      setAvatarUri(null);
      setAvatarBase64(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Profil güncellenemedi.';
      Alert.alert('Hata', String(msg));
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    setAvatarBase64(null);
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
    setEditing(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
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

          {editing ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Ad Soyad"
                value={fullName}
                onChangeText={setFullName}
              />
              <TextInput
                style={[styles.input, styles.bioInput]}
                placeholder="Hakkında"
                value={bio}
                onChangeText={setBio}
                multiline
              />
              <TextInput
                style={styles.input}
                placeholder="Şehir"
                value={city}
                onChangeText={setCity}
              />
              <TextInput
                style={styles.input}
                placeholder="Ülke"
                value={country}
                onChangeText={setCountry}
              />
              <TextInput
                style={styles.input}
                placeholder="Instagram"
                value={instagram}
                onChangeText={setInstagram}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Twitter/X"
                value={twitter}
                onChangeText={setTwitter}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Facebook"
                value={facebook}
                onChangeText={setFacebook}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Web sitesi"
                value={website}
                onChangeText={setWebsite}
                autoCapitalize="none"
                keyboardType="url"
              />
              <TextInput
                style={[styles.input, styles.bioInput]}
                placeholder="İlgi alanları (virgülle ayır: Kahve, Spor, Yemek)"
                value={interests}
                onChangeText={setInterests}
              />
              <View style={styles.locationSection}>
                <Text style={styles.locationLabel}>Konum</Text>
                <Text style={styles.locationHint}>
                  Yakındaki kullanıcıları göstermek için cihazınızın konumunu kullanırız. Manuel giriş yapılamaz.
                </Text>
                <TouchableOpacity
                  style={[styles.locationButton, locationLoading && styles.disabled]}
                  onPress={getDeviceLocation}
                  disabled={locationLoading}
                >
                  {locationLoading ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <>
                      <Ionicons name="location" size={20} color={colors.white} style={{ marginRight: 8 }} />
                      <Text style={styles.locationButtonText}>
                        {profile?.latitude != null && profile?.longitude != null
                          ? 'Konumumu Güncelle'
                          : 'Konumumu Seç'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                {(profile?.latitude != null && profile?.longitude != null) && (
                  <Text style={styles.locationStatus}>Konum ayarlandı</Text>
                )}
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingTextWrap}>
                  <Text style={styles.settingLabel}>Profili herkese açık göster</Text>
                  <Text style={styles.settingHint}>Kapalıyken sadece arkadaşların görebilir</Text>
                </View>
                <Switch
                  value={profileVisible}
                  onValueChange={setProfileVisible}
                  trackColor={{ false: colors.border, true: colors.primary + '80' }}
                  thumbColor={profileVisible ? colors.primary : '#f4f3f4'}
                />
              </View>
              <View style={styles.editButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelBtnText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.disabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <Text style={styles.saveBtnText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.name}>{profile?.full_name || 'Profil'}</Text>
              {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
              {(profile?.city || profile?.country) && (
                <Text style={styles.location}>
                  {[profile?.city, profile?.country].filter(Boolean).join(', ')}
                </Text>
              )}
              {profile?.latitude != null && profile?.longitude != null && (
                <Text style={styles.locationSet}>Konum ayarlandı</Text>
              )}
              {(profile?.instagram || profile?.twitter || profile?.facebook) && (
                <View style={styles.socialRow}>
                  {profile?.instagram && <Text style={styles.social}>@{profile.instagram}</Text>}
                  {profile?.twitter && <Text style={styles.social}>@{profile.twitter}</Text>}
                  {profile?.facebook && <Text style={styles.social}>Facebook</Text>}
                </View>
              )}
              <TouchableOpacity style={styles.editButton} onPress={startEditing}>
                <Text style={styles.editButtonText}>Profili Düzenle</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarButton: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.white,
    fontSize: 36,
    fontWeight: '600',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  bio: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 8,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  social: {
    fontSize: 14,
    color: colors.primary,
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
  editButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveBtnText: {
    color: colors.white,
    fontWeight: '600',
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
  locationSet: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  editButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  editButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  logoutButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
});
