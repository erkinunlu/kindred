# Supabase Kayıt Sorunu - Kontrol Listesi

Kayıt çalışmıyorsa Supabase Dashboard'da şunları kontrol edin:

## 1. Authentication > Providers > Email

- **Enable Email provider**: Açık olmalı
- **Enable Email Signup**: Açık olmalı (kapalıysa "Signups not allowed" hatası alırsınız)
- **Confirm email**: Geliştirme için kapatın (açıksa kullanıcı email onayı bekler)

## 2. Authentication > Settings

- **Site URL**: `https://your-project.supabase.co` veya uygulama URL'niz
- **Disable new signups**: Kapalı olmalı

## 3. .env Dosyası

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

- URL'de `https://` olmalı
- Anahtar `eyJ` ile başlamalı (JWT formatı)
- **APK build sonrası .env değiştiyse mutlaka yeniden build alın**

## 4. Migration'lar Çalıştı mı?

SQL Editor'de sırayla:
- `00001_initial_schema.sql`
- `00002_posts_profile_relation.sql`
- `00003_reports_blocks.sql`
- `00004_auto_create_profile.sql`
- `00005_fix_profiles_rls_recursion.sql`
- `00006_profiles_posts_extended.sql` ← **Gönderi (resim/video) için gerekli**
- `00007_hashtags_profile_visibility.sql` ← **Profil gizlilik ayarı**

## 5. Storage (avatars bucket)

- **Storage > Buckets**: `avatars` bucket'ı olmalı ve **public** olmalı
- Bucket yoksa migration 00001 çalıştırılmamış olabilir
- **Storage > Policies**: avatars için INSERT ve SELECT policy'leri tanımlı olmalı

## 6. Gönderi / Profil resmi

- **Gönderi oluşturulamıyorsa**: Profil onaylı mı? (status = 'approved') Sadece onaylı kullanıcılar gönderi oluşturabilir
- **Profil resmi yüklenemiyorsa**: Storage bucket ve policy'leri kontrol edin

## 7. Test

Supabase Dashboard > Authentication > Users bölümünde yeni kayıtları görebilirsiniz. Kayıt başarılıysa kullanıcı orada görünür.
