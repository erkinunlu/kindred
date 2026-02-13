import { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/constants/theme';
import { formatLocationDisplay } from '@/lib/locationUtils';
import { Text as AppText } from '@/components/Text';

const LIGHT_PINK = '#FCE4EC';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, session, refreshProfile, signOut } = useAuth();
  const [locationLoading, setLocationLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const email = session?.user?.email || '';
  const locationText = formatLocationDisplay(profile || {}) || 'Konum belirlenmedi';

  const updateLocation = async () => {
    if (!profile?.user_id) return;
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Konum izni gerekli',
          'Yakındaki kullanıcıları gösterebilmek için konum erişimine izin vermeniz gerekiyor.'
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
      Alert.alert('Başarılı', 'Konumunuz güncellendi.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Konum alınamadı.';
      Alert.alert('Hata', String(msg));
    } finally {
      setLocationLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Hesabı Sil',
      'Hesabınız ve tüm verileriniz kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Hesabımı Sil',
          style: 'destructive',
          onPress: async () => {
            setDeleteLoading(true);
            try {
              const { error } = await supabase.auth.deleteUser();
              if (error) throw error;
              await signOut();
              router.replace('/(auth)/login');
            } catch (err) {
              Alert.alert('Hata', 'Hesap silinirken bir hata oluştu. Lütfen destek ile iletişime geçin.');
            } finally {
              setDeleteLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>Ayarlar</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hesap Ayarları */}
        <AppText style={styles.sectionTitle}>Hesap Ayarları</AppText>

        {/* E-posta */}
        <View style={styles.card}>
          <AppText style={styles.cardLabel}>E-posta Adresi</AppText>
          <View style={styles.cardRow}>
            <Ionicons name="mail-outline" size={22} color={colors.textMuted} />
            <AppText style={styles.cardValue}>{email || '—'}</AppText>
          </View>
        </View>

        {/* Konum - sadece göster, Güncelle butonu */}
        <View style={styles.card}>
          <AppText style={styles.cardLabel}>Konum</AppText>
          <View style={styles.cardRow}>
            <Ionicons name="location-outline" size={22} color={colors.textMuted} />
            <AppText style={styles.cardValue}>{locationText}</AppText>
          </View>
          <TouchableOpacity
            style={[styles.updateBtn, locationLoading && styles.updateBtnDisabled]}
            onPress={updateLocation}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <AppText style={styles.updateBtnText}>Konumu Güncelle</AppText>
            )}
          </TouchableOpacity>
        </View>

        {/* Dil */}
        <TouchableOpacity style={styles.card} onPress={() => Alert.alert('Dil', 'Yakında dil seçeneği eklenecek.')}>
          <AppText style={styles.cardLabel}>Dil</AppText>
          <View style={styles.cardRow}>
            <Ionicons name="globe-outline" size={22} color={colors.textMuted} />
            <AppText style={styles.cardValue}>Türkçe</AppText>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
        </TouchableOpacity>

        {/* Hesap Yönetimi */}
        <AppText style={[styles.sectionTitle, { marginTop: 32 }]}>Hesap Yönetimi</AppText>

        <View style={styles.card}>
          <View style={styles.deleteCardContent}>
            <View style={styles.deleteIconWrap}>
              <Ionicons name="trash-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.deleteTextWrap}>
              <AppText style={styles.deleteTitle}>Hesabı Sil</AppText>
              <AppText style={styles.deleteSubtext}>Hesabını ve tüm verilerini kalıcı olarak sil</AppText>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.deleteBtn, deleteLoading && styles.deleteBtnDisabled]}
            onPress={handleDeleteAccount}
            disabled={deleteLoading}
          >
            {deleteLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <AppText style={styles.deleteBtnText}>Hesabımı Sil</AppText>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: LIGHT_PINK,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
    marginBottom: 8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardValue: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  updateBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  updateBtnDisabled: {
    opacity: 0.6,
  },
  updateBtnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: fonts.semiBold,
  },
  deleteCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  deleteIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deleteTextWrap: {
    flex: 1,
  },
  deleteTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.text,
    marginBottom: 2,
  },
  deleteSubtext: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  deleteBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteBtnDisabled: {
    opacity: 0.6,
  },
  deleteBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
});
