import { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, fonts } from '@/constants/theme';
import { Link, router } from 'expo-router';
import { supabase } from '@/lib/supabase';

function formatDate(date: Date): string {
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [birthDateStr, setBirthDateStr] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async () => {
    setErrorMsg('');
    if (!fullName.trim() || !email.trim() || !password) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun.');
      return;
    }

    if (!termsAccepted) {
      Alert.alert('Hata', 'Kullanım Koşulları ve Gizlilik Politikasını kabul etmelisiniz.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır.');
      return;
    }

    setLoading(true);
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      if (!supabaseUrl || supabaseUrl.includes('your-project')) {
        setErrorMsg('Supabase bağlantısı yapılandırılmamış. .env dosyasını kontrol edin.');
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        const msg = error.message || JSON.stringify(error);
        setErrorMsg(msg);
        if (error.message?.includes('Signups not allowed')) {
          setErrorMsg('Kayıtlar şu an kapalı. Supabase Dashboard > Authentication > Providers > Email bölümünden "Enable email signup" açın.');
        }
        return;
      }

      if (data.user) {
        if (data.session) {
          const birthDateIso = birthDate?.toISOString().split('T')[0] || null;
          router.replace({
            pathname: '/(auth)/face-verification',
            params: { fullName: fullName.trim(), birthDate: birthDateIso || '' },
          });
        } else {
          setErrorMsg('Kayıt başarılı! E-posta onayı gerekiyor. Gelen linke tıklayıp ardından Giriş Yap\'a basın.');
        }
      } else {
        setErrorMsg('Beklenmeyen yanıt. Lütfen tekrar deneyin.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg || 'Bağlantı hatası. İnternet ve Supabase ayarlarını kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (_: unknown, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setBirthDate(date);
      setBirthDateStr(formatDate(date));
    }
  };

  const handleTermsLink = (type: 'terms' | 'privacy') => {
    Alert.alert('Bilgi', `${type === 'terms' ? 'Kullanım Koşulları' : 'Gizlilik Politikası'} sayfası yakında eklenecek.`);
  };

  const handleSocialRegister = (provider: string) => {
    Alert.alert('Yakında', `${provider} ile kayıt yakında eklenecek.`);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Ionicons name="heart" size={48} color={colors.primary} />
          </View>
        </View>

        <Text style={styles.title}>Hesap Oluştur</Text>
        <Text style={styles.subtitle}>Aramıza katılmak için bilgilerinizi girin</Text>

        <Text style={styles.label}>Ad Soyad</Text>
        <View style={styles.inputWrap}>
          <Ionicons name="person-outline" size={22} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Meltem Yılmaz"
            placeholderTextColor={colors.textMuted}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoComplete="name"
          />
        </View>

        <Text style={styles.label}>E-posta</Text>
        <View style={styles.inputWrap}>
          <Ionicons name="mail-outline" size={22} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="ornek@email.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </View>

        <Text style={styles.label}>Doğum Tarihi</Text>
        <TouchableOpacity
          style={styles.inputWrap}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={22} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="gg/aa/yyyy"
            placeholderTextColor={colors.textMuted}
            value={birthDateStr}
            editable={false}
          />
          <Ionicons name="calendar" size={20} color={colors.textMuted} style={styles.inputRightIcon} />
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={birthDate || new Date(2000, 0, 1)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            maximumDate={new Date()}
            minimumDate={new Date(1920, 0, 1)}
          />
        )}

        {Platform.OS === 'ios' && showDatePicker && (
          <TouchableOpacity style={styles.datePickerDone} onPress={() => setShowDatePicker(false)}>
            <Text style={styles.datePickerDoneText}>Tamam</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Şifre</Text>
        <View style={styles.inputWrap}>
          <Ionicons name="lock-closed-outline" size={22} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="........"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />
        </View>

        <View style={styles.checkboxWrap}>
          <TouchableOpacity
            onPress={() => setTermsAccepted((v) => !v)}
            style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}
          >
            {termsAccepted && <Ionicons name="checkmark" size={14} color="#fff" />}
          </TouchableOpacity>
          <Text style={styles.checkboxText}>
            <Text style={styles.checkboxLink} onPress={() => handleTermsLink('terms')}>
              Kullanım Koşulları
            </Text>
            <Text style={styles.checkboxTextGray}> ve </Text>
            <Text style={styles.checkboxLink} onPress={() => handleTermsLink('privacy')}>
              Gizlilik Politikasını
            </Text>
            <Text style={styles.checkboxTextGray}> kabul ediyorum.</Text>
          </Text>
        </View>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Kayıt yapılıyor...' : 'KAYIT OL'}</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Zaten bir hesabın var mı? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={styles.link}>Giriş Yap</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <View style={styles.dividerWrap}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Veya şununla devam et</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialRow}>
          <TouchableOpacity
            style={styles.socialBtn}
            onPress={() => handleSocialRegister('Google')}
          >
            <Ionicons name="logo-google" size={28} color="#4285F4" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.socialBtn}
            onPress={() => handleSocialRegister('Apple')}
          >
            <Ionicons name="logo-apple" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF7F8',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#fce7f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 28,
    textAlign: 'center',
    fontFamily: fonts.light,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.text,
    fontFamily: fonts.regular,
  },
  inputRightIcon: {
    marginLeft: 8,
  },
  checkboxWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
    padding: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  checkboxTextGray: {
    color: colors.textSecondary,
  },
  checkboxLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  datePickerDone: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 16,
  },
  datePickerDoneText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: fonts.regular,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  socialBtn: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
