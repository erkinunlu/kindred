import { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, fonts } from '@/constants/theme';
import { uriToArrayBuffer, base64ToArrayBufferFromPicker } from '@/lib/uploadUtils';

export default function CreatePostScreen() {
  const { profile } = useAuth();
  const [content, setContent] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin gerekli', 'Fotoğraf seçmek için galeri izni gerekiyor.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    const asset = result.canceled ? null : result.assets?.[0];
    if (asset) {
      setImageUri(asset.uri);
      setImageBase64(asset.base64 ?? null);
    }
  };

  const removeImage = () => {
    setImageUri(null);
    setImageBase64(null);
  };

  const submit = async () => {
    if (!content.trim() && !imageUri) {
      Alert.alert('Uyarı', 'Metin veya fotoğraf ekleyin.');
      return;
    }
    if (!profile?.user_id) return;
    setLoading(true);
    try {
      let mediaUrl: string | null = null;
      let postType: 'text' | 'image' | 'video' = 'text';

      if (imageUri) {
        let arrayBuffer: ArrayBuffer;
        if (imageBase64) {
          arrayBuffer = base64ToArrayBufferFromPicker(imageBase64);
        } else {
          arrayBuffer = await uriToArrayBuffer(imageUri);
        }
        const fileName = `${profile.user_id}/${Date.now()}.jpg`;
        const { error } = await supabase.storage
          .from('posts')
          .upload(fileName, arrayBuffer, { upsert: true, contentType: 'image/jpeg' });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName);
        mediaUrl = urlData.publicUrl;
        postType = 'image';
      }

      const { error } = await supabase.from('posts').insert({
        user_id: profile.user_id,
        content: content.trim() || null,
        post_type: postType,
        media_url: mediaUrl,
      });
      if (error) throw error;
      router.back();
    } catch (e) {
      console.error('Create post error:', e);
      Alert.alert('Hata', (e as Error).message || 'Gönderi oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yeni Gönderi</Text>
        <TouchableOpacity
          onPress={submit}
          disabled={loading}
          style={styles.headerBtn}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.publishBtn}>Paylaş</Text>
          )}
        </TouchableOpacity>
      </View>
      <View style={styles.body}>
        <View style={styles.userRow}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{profile?.full_name?.charAt(0) || '?'}</Text>
            </View>
          )}
          <Text style={styles.userName}>{profile?.full_name || 'Anonim'}</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Ne düşünüyorsun?"
          placeholderTextColor={colors.textMuted}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />
        {imageUri && (
          <View style={styles.previewWrap}>
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
            <TouchableOpacity style={styles.removeBtn} onPress={removeImage}>
              <Ionicons name="close-circle" size={32} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity style={styles.addPhoto} onPress={pickImage}>
          <Ionicons name="image-outline" size={28} color={colors.textMuted} />
          <Text style={styles.addPhotoText}>Fotoğraf ekle</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { minWidth: 44, alignItems: 'flex-end' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  publishBtn: { fontSize: 16, fontWeight: '600', color: colors.primary },
  body: { padding: 16 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  userName: { marginLeft: 12, fontSize: 16, fontWeight: '600', color: colors.text },
  input: {
    fontSize: 16,
    color: colors.text,
    fontFamily: fonts.regular,
    minHeight: 120,
    marginBottom: 16,
  },
  previewWrap: { position: 'relative', marginBottom: 16 },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: colors.border },
  removeBtn: { position: 'absolute', top: 8, right: 8 },
  addPhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  addPhotoText: { fontSize: 15, color: colors.textMuted },
});
