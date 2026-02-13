# iOS IPA Build Talimatları

## Ön Gereksinimler

1. **Xcode** kurulu olmalı
2. **Apple ID** Xcode'a eklenmiş olmalı
3. **Team ID** alınmalı

## Team ID Alma

### Sadece "Personal Team" görüyorsanız (ücretsiz hesap)

Personal Team'de Team ID Xcode menüsünde görünmez. Şu adımları izleyin:

```bash
npm run build:ipa:setup
```

1. Bu komut iOS projesini oluşturur ve Xcode'u açar
2. Xcode'da sol taraftan **KindRed** projesini seçin
3. **KindRed** target'ını seçin (PROJECT değil, TARGETS altındaki)
4. Üstte **Signing & Capabilities** sekmesine tıklayın
5. **Team** dropdown'ından **Personal Team** seçin
6. Xcode'u kapatın (⌘Q)
7. Sonra `npm run build:ipa` çalıştırın — script Team ID'yi otomatik alacaktır

### Ücretli Developer hesabınız varsa

1. Xcode > **Settings** (⌘,) > **Accounts**
2. Apple ID'nizi seçin
3. Sağ tarafta **Team** listesinde Team ID parantez içinde görünür (örn: `ABC123XYZ0`)
4. `.env` dosyasına ekleyin: `EXPO_IOS_DEVELOPMENT_TEAM=ABC123XYZ0`

## Kurulum

1. `.env` dosyasına Team ID ekleyin:

```
EXPO_IOS_DEVELOPMENT_TEAM=TEAM_ID_BURAYA
```

2. Örnek: `EXPO_IOS_DEVELOPMENT_TEAM=ABC123XYZ0`

## IPA Build

```bash
npm run build:ipa
```

veya

```bash
bash scripts/build-ipa.sh
```

Build tamamlandığında `kindred.ipa` dosyası proje kökünde oluşur.

## IPA'yı Cihaza Yükleme

- **Development** profili ile oluşturulan IPA sadece Xcode'da kayıtlı cihazlara yüklenebilir
- Cihazı USB ile bağlayın, Xcode > Window > Devices and Simulators'dan cihazı ekleyin
- IPA'yı Finder ile cihaza sürükleyip bırakabilir veya `ios-deploy` kullanabilirsiniz

## Sorun Giderme

- **"Signing requires a development team"**: `.env` dosyasında `EXPO_IOS_DEVELOPMENT_TEAM` tanımlı mı kontrol edin
- **"No valid identities"**: Xcode'da Apple ID ekleyin ve bir kez manuel build deneyin
- **"xcode-select"**: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` çalıştırın
