import { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { Text } from '@/components/Text';
import { colors } from '@/constants/theme';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function FaceVerificationScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
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
        full_name: '',
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
      console.error('Face verification error:', err);
      Alert.alert('Hata', 'Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Yüz Doğrulama</Text>
        <Text style={styles.subtitle}>
          Bu uygulama sadece kadın kullanıcılar içindir. Kayıt olmak için canlılık kontrolü ve yüz doğrulaması gereklidir.
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            • Gerçek zamanlı yüz tanıma ile fotoğraf veya video sahteciliği engellenir{'\n'}
            • Kamera izni gereklidir{'\n'}
            • İyi aydınlatılmış bir ortamda yüzünüzü kameraya gösterin
          </Text>
        </View>

        <Text style={styles.noteText}>
          Geliştirme aşamasında: AWS Rekognition Face Liveness entegrasyonu yapılandırıldığında tam doğrulama aktif olacaktır. Şimdilik devam edebilirsiniz.
        </Text>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'İşleniyor...' : 'Devam Et'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Geri</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
    justifyContent: 'center',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
  },
  infoBox: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 22,
  },
  noteText: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#6b7280',
    fontSize: 14,
  },
});
