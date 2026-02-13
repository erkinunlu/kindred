# APK Build Talimatları

## GitHub Push ✅
Değişiklikler başarıyla `origin/main` branch'ine push edildi.

## APK Build (EAS)

APK oluşturmak için önce Expo hesabınıza giriş yapmanız gerekiyor:

```bash
# 1. EAS CLI ile giriş yapın
eas login

# 2. Android APK build başlatın
eas build --platform android --profile preview
```

Build tamamlandığında APK dosyası Expo sunucularından indirilebilir.

## Alternatif: Lokal Build

Android Studio ve SDK kuruluysa:

```bash
# Önce prebuild (native projeleri oluşturur)
npx expo prebuild --platform android

# Release APK oluştur
cd android && ./gradlew assembleRelease
```

APK dosyası: `android/app/build/outputs/apk/release/app-release.apk`
