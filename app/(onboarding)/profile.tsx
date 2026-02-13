import { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Text } from '@/components/Text';
import { colors, fonts } from '@/constants/theme';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { uriToArrayBuffer, base64ToArrayBufferFromPicker } from '@/lib/uploadUtils';

export default function ProfileSetupScreen() {
  const { session } = useAuth();
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    if (!fullName.trim()) {
      Alert.alert('Hata', 'Lütfen adınızı girin.');
      return;
    }

    if (!session?.user) {
      router.replace('/(auth)/login');
      return;
    }

    setLoading(true);
    try {
      let avatarUrl: string | null = null;

      if (avatarUri) {
        const fileName = `${session.user.id}/avatar_${Date.now()}.jpg`;
        const arrayBuffer = avatarBase64
          ? base64ToArrayBufferFromPicker(avatarBase64)
          : await uriToArrayBuffer(avatarUri);
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, arrayBuffer, { upsert: true, contentType: 'image/jpeg' });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
          avatarUrl = urlData?.publicUrl || null;
        } else {
          Alert.alert('Hata', 'Profil fotoğrafı yüklenemedi: ' + (uploadError.message || 'Bilinmeyen hata'));
        }
      }

      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: session.user.id,
          full_name: fullName.trim(),
          bio: bio.trim() || null,
          avatar_url: avatarUrl,
          gender: 'female',
          status: 'pending',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        Alert.alert('Hata', error.message);
        return;
      }

      router.replace('/pending-approval');
    } catch (err) {
      Alert.alert('Hata', 'Profil kaydedilemedi. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Profilini Oluştur</Text>
          <Text style={styles.subtitle}>
            Profilin onaylandıktan sonra uygulamayı kullanmaya başlayabilirsin.
          </Text>

          <TouchableOpacity style={styles.avatarButton} onPress={pickImage}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
            ) : (
              <Text style={styles.avatarPlaceholderText}>+ Fotoğraf Ekle</Text>
            )}
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Ad Soyad"
            placeholderTextColor="#9ca3af"
            value={fullName}
            onChangeText={setFullName}
            autoComplete="name"
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Hakkında (isteğe bağlı)"
            placeholderTextColor="#9ca3af"
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Kaydediliyor...' : 'Profilimi Gönder'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 48,
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
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
    marginBottom: 32,
  },
  avatarButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  avatarPreview: {
    width: 100,
    height: 100,
  },
  avatarPlaceholderText: {
    color: '#6b7280',
    fontSize: 14,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    color: '#1f2937',
    fontFamily: fonts.regular,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
