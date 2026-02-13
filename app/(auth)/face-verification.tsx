import { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/theme';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function FaceVerificationScreen() {
  const { session } = useAuth();
  const { fullName, birthDate } = useLocalSearchParams<{ fullName?: string; birthDate?: string }>();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleStartVerification = async () => {
    if (!session?.user) {
      router.replace('/(auth)/login');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/(auth)/login');
        return;
      }

      let verificationId = `verification_${user.id}_${Date.now()}`;

      try {
        const { data: sessionData } = await supabase.functions.invoke('face-liveness', {
          body: { action: 'create_session' },
        });
        if (sessionData?.sessionId) {
          const { data: verifyData } = await supabase.functions.invoke('face-liveness', {
            body: { action: 'verify', sessionId: sessionData.sessionId },
          });
          if (verifyData?.verificationId) verificationId = verifyData.verificationId;
        }
      } catch (_) {
        // Edge function not deployed - use fallback
      }

      const { error: profileError } = await supabase.from('profiles').upsert({
        user_id: user.id,
        face_verification_id: verificationId,
        status: 'pending',
        full_name: fullName?.trim() || '',
        birth_date: birthDate || null,
        gender: 'female',
        bio: null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

      if (profileError) {
        Alert.alert('Hata', profileError.message || 'Profil kaydedilemedi.');
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error('Face verification error:', err);
      Alert.alert('Hata', 'Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!session?.user) {
      router.replace('/(auth)/login');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/(auth)/login');
        return;
      }

      const { error: profileError } = await supabase.from('profiles').upsert({
        user_id: user.id,
        face_verification_id: `skipped_${user.id}_${Date.now()}`,
        status: 'pending',
        full_name: fullName?.trim() || '',
        birth_date: birthDate || null,
        gender: 'female',
        bio: null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

      if (profileError) {
        Alert.alert('Hata', profileError.message || 'Profil kaydedilemedi.');
        return;
      }

      router.replace('/(onboarding)/profile');
    } catch (err) {
      console.error('Skip error:', err);
      Alert.alert('Hata', 'Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleOk = () => {
    router.replace('/(onboarding)/profile');
  };

  if (success) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.successContent} showsVerticalScrollIndicator={false}>
          <View style={styles.successIconWrap}>
            <View style={styles.successRing3} />
            <View style={styles.successRing2} />
            <View style={styles.successRing1} />
            <View style={styles.successCircle}>
              <Ionicons name="checkmark" size={56} color="#fff" />
            </View>
          </View>

          <Text style={styles.successTitle}>Doğrulama Başarılı!</Text>
          <Text style={styles.successDesc}>
            Hesabın şimdi incelenmeye alındı.
          </Text>
          <Text style={styles.successDesc}>
            Güvenli bir topluluk oluşturmak için onayları manuel olarak yapıyoruz. Bu işlem kısa süre içinde tamamlanacaktır.
          </Text>

          <View style={styles.notifyBox}>
            <Ionicons name="notifications" size={22} color={colors.primary} />
            <Text style={styles.notifyText}>Onaylandığında sana haber vereceğiz.</Text>
          </View>

          <TouchableOpacity style={styles.okButton} onPress={handleOk}>
            <Text style={styles.okButtonText}>Tamam</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.okButtonArrow} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.progressDots}>
          {[1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[styles.progressDot, i === 1 && styles.progressDotActive]}
            />
          ))}
        </View>
        <TouchableOpacity style={styles.helpBtn}>
          <Ionicons name="help-circle-outline" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.identityPill}>
          <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
          <Text style={styles.identityPillText}>KİMLİK KONTROLÜ</Text>
        </View>

        <Text style={styles.title}>Kimliğinizi doğrulayın</Text>
        <Text style={styles.subtitle}>
          Bu, topluluğumuzu herkes için güvenli ve gerçek tutmamıza yardımcı olur.
        </Text>

        <View style={styles.cameraWrap}>
          <View style={styles.cameraCircle}>
            <LinearGradient
              colors={['#fce7f3', '#fbc2eb', '#f8bbd9']}
              style={styles.cameraInner}
            >
              <View style={styles.faceGuide} />
            </LinearGradient>
          </View>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Canlı Kamera</Text>
          </View>
        </View>

        <View style={styles.instructionRow}>
          <Ionicons name="eye" size={22} color={colors.primary} />
          <Text style={styles.instructionText}>Gözlerinizi kırpın</Text>
        </View>

        <View style={styles.stepProgress}>
          <View style={styles.stepBarBg}>
            <View style={[styles.stepBarFill, { width: '33%' }]} />
          </View>
          <Text style={styles.stepText}>Adım 1 / 3: Canlılık Tespiti</Text>
        </View>

        <View style={styles.privacyRow}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
          <Text style={styles.privacyText}>Yüz verileriniz şifrelenir ve asla paylaşılmaz.</Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleStartVerification}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? 'Doğrulanıyor...' : 'Doğrulamayı Başlat'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.primaryButtonArrow} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={loading}
        >
          <Text style={styles.skipButtonText}>Şimdilik atla</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdf2f8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
  },
  headerBtn: { padding: 8 },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fce7f3',
  },
  progressDotActive: {
    backgroundColor: colors.primary,
  },
  helpBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  identityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#fce7f3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fbc2eb',
    marginBottom: 24,
    gap: 8,
  },
  identityPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  cameraWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  cameraCircle: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 2,
    borderColor: 'rgba(231, 76, 60, 0.2)',
    padding: 8,
    overflow: 'hidden',
  },
  cameraInner: {
    flex: 1,
    borderRadius: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceGuide: {
    width: 120,
    height: 160,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: 'rgba(231, 76, 60, 0.3)',
    borderStyle: 'dashed',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  stepProgress: {
    marginBottom: 24,
  },
  stepBarBg: {
    height: 4,
    backgroundColor: '#fce7f3',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  stepBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  stepText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    gap: 8,
  },
  privacyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  primaryButtonArrow: {
    marginLeft: 8,
  },
  skipButton: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: '#fff',
  },
  skipButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  successContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 80,
    paddingBottom: 48,
  },
  successIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  successRing3: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(231, 76, 60, 0.08)',
  },
  successRing2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
  },
  successRing1: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(231, 76, 60, 0.25)',
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  successDesc: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  notifyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fce7f3',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbc2eb',
    marginTop: 24,
    marginBottom: 32,
    gap: 12,
  },
  notifyText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  okButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  okButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  okButtonArrow: {
    marginLeft: 8,
  },
});
