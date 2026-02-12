# KindRed - Vercel Deployment

## 1. GitHub'a Yükle

Projeyi GitHub'a push edin (henüz reponuz yoksa oluşturun):

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/KULLANICI/kindred.git
git push -u origin main
```

## 2. Vercel'e Bağla

1. [vercel.com](https://vercel.com) → **Add New** → **Project**
2. GitHub reponuzu seçin
3. **Import** tıklayın

## 3. Ortam Değişkenleri

Vercel'de **Settings** → **Environment Variables** bölümüne ekleyin:

| İsim | Değer |
|-----|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` |

`.env` dosyanızdaki değerleri kopyalayın.

## 4. Build Ayarları

Vercel otomatik olarak `vercel.json`'daki ayarları kullanacak:

- **Build Command:** `npx expo export -p web`
- **Output Directory:** `dist`
- **Framework Preset:** Other

## 5. Deploy

**Deploy** tıklayın. Build tamamlandığında uygulama canlıya alınır.

## 6. Supabase Ayarları

### Auth Redirect URLs
Supabase Dashboard → **Authentication** → **URL Configuration**:
- **Site URL:** `https://your-project.vercel.app`
- **Redirect URLs:** `https://your-project.vercel.app/**` ekleyin

### Storage CORS (gerekirse)
Storage yükleme hatası alırsanız, Supabase projesinde Storage bucket'ın public olduğundan emin olun. Genelde public bucket'lar tüm origin'lere izin verir.

## Not

- Web versiyonunda kamera/face verification gibi native özellikler sınırlı çalışabilir
- Resim/video yükleme web tarayıcıda genellikle daha stabil çalışır
- Mobil deneyim için Expo Go veya APK build kullanın
