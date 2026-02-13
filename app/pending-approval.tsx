import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@/components/Text';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function PendingApprovalScreen() {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>⏳</Text>
        <Text style={styles.title}>Onay Bekleniyor</Text>
        <Text style={styles.subtitle}>
          Profilin inceleniyor. Onaylandığında uygulamayı kullanmaya başlayabilirsin. Bu işlem genellikle 24 saat içinde tamamlanır.
        </Text>

        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
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
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  logoutButton: {
    padding: 12,
    paddingHorizontal: 24,
  },
  logoutButtonText: {
    color: '#6b7280',
    fontSize: 14,
  },
});
