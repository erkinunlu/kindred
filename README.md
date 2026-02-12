# Kadınlar Sosyal - Arkadaşlık Uygulaması

Sadece kadın kullanıcıların erişebildiği, yüz/canlılık doğrulaması ve profil onayı gerektiren arkadaş bulma sosyal medya uygulaması.

## Kurulum

### 1. Bağımlılıklar

```bash
npm install
```

### 2. Supabase Projesi

1. [Supabase](https://supabase.com) dashboard'da yeni proje oluşturun
2. SQL Editor'de migration dosyalarını sırayla çalıştırın:
   - `00001_initial_schema.sql`
   - `00002_posts_profile_relation.sql`
   - `00003_reports_blocks.sql`
   - `00004_auto_create_profile.sql` (yeni kullanıcı kaydında otomatik profil oluşturur)
3. Storage > Buckets'ta `avatars` bucket'ının oluştuğunu kontrol edin

### 3. Ortam Değişkenleri

`.env` dosyası oluşturun:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Uygulamayı Çalıştırma

```bash
npx expo start
```

### 5. Profil Onayı

Profil onayı için Supabase Dashboard > Table Editor > profiles tablosuna gidin. `status` alanını `approved` olarak güncelleyin.

### 6. Email Onayını Kapat (Önerilen - Geliştirme için)

Supabase Dashboard > Authentication > Providers > Email > **"Confirm email"** seçeneğini kapatın. Böylece kayıt sonrası kullanıcı direkt giriş yapabilir. (Production'da güvenlik için açık bırakın.)

## Proje Yapısı

- `app/(auth)` - Kayıt, giriş, yüz doğrulama
- `app/(onboarding)` - Profil oluşturma
- `app/(tabs)` - Ana uygulama (akış, keşfet, mesajlar, profil)
- `app/pending-approval` - Onay bekleniyor ekranı

## Yüz Doğrulama

Geliştirme aşamasında AWS Rekognition Face Liveness entegrasyonu hazır değildir. Supabase Edge Functions ile `face-liveness` fonksiyonu eklendiğinde tam doğrulama aktif olacaktır.

## Edge Function Deploy

```bash
supabase functions deploy face-liveness
```

## App Store / Play Store

Yayına hazırlık için:
- `app.json` içinde `name`, `version`, `ios.bundleIdentifier`, `android.package` ayarlayın
- Apple Developer ($99/yıl) ve Google Play Developer ($25 tek seferlik) hesapları gerekir
- `eas build` ile production build alın
