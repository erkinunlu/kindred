import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/theme';

export default function PendingApprovalScreen() {
  const { signOut } = useAuth();

  const handleOk = () => {
    // Kullanıcı bilgilendirildi, ekranda kalır
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.successIconWrap}>
          <View style={styles.successRing3} />
          <View style={styles.successRing2} />
          <View style={styles.successRing1} />
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={56} color="#fff" />
          </View>
        </View>

        <Text style={styles.title}>Doğrulama Başarılı!</Text>
        <Text style={styles.desc}>
          Hesabın şimdi incelenmeye alındı.
        </Text>
        <Text style={styles.desc}>
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

        <TouchableOpacity style={styles.logoutLink} onPress={() => { signOut(); router.replace('/(auth)/login'); }}>
          <Text style={styles.logoutLinkText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdf2f8',
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 80,
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  desc: {
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
  logoutLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  logoutLinkText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
