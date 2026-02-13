#!/bin/bash
# iOS IPA Build Script
# Önce: .env dosyasına EXPO_IOS_DEVELOPMENT_TEAM=TEAM_ID ekleyin
# Team ID: Xcode > Preferences > Accounts > Apple ID > Team

set -e
cd "$(dirname "$0")/.."

# .env yükle
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Team ID yoksa proje dosyasından dene (Personal Team için - Xcode'da seçildiyse)
if [ -z "$EXPO_IOS_DEVELOPMENT_TEAM" ] && [ -f ios/KindRed.xcodeproj/project.pbxproj ]; then
  EXPO_IOS_DEVELOPMENT_TEAM=$(grep "DEVELOPMENT_TEAM" ios/KindRed.xcodeproj/project.pbxproj | sed -n 's/.*DEVELOPMENT_TEAM = \([A-Z0-9]*\).*/\1/p' | head -1)
fi

if [ -z "$EXPO_IOS_DEVELOPMENT_TEAM" ]; then
  echo "Hata: EXPO_IOS_DEVELOPMENT_TEAM tanımlı değil."
  echo ""
  echo "Personal Team kullanıyorsanız (sadece 'Personal Team' görüyorsanız):"
  echo "  1. npm run build:ipa:setup  çalıştırın"
  echo "  2. Xcode açılacak - Signing & Capabilities'da 'Personal Team' seçin"
  echo "  3. Xcode'u kapatın"
  echo "  4. npm run build:ipa  tekrar çalıştırın"
  echo ""
  echo "Veya .env dosyasına ekleyin: EXPO_IOS_DEVELOPMENT_TEAM=TEAM_ID"
  exit 1
fi

echo "Team ID: $EXPO_IOS_DEVELOPMENT_TEAM"
echo ""

# Prebuild için export et (app.config.js kullanacak)
export EXPO_IOS_DEVELOPMENT_TEAM

# Xcode path
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer

# Prebuild (developmentTeam ile)
echo "1. iOS prebuild çalıştırılıyor..."
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 CI=1 npx expo prebuild --platform ios --clean

# Pod install
echo "2. CocoaPods yükleniyor..."
cd ios && LANG=en_US.UTF-8 pod install && cd ..

# Archive
echo "3. Archive oluşturuluyor..."
ARCHIVE_PATH="ios/build/KindRed.xcarchive"
rm -rf "$ARCHIVE_PATH"
xcodebuild -workspace ios/KindRed.xcworkspace -scheme KindRed \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  archive \
  -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration

# ExportOptions.plist oluştur
EXPORT_OPTS="ios/ExportOptions.plist"
cat > "$EXPORT_OPTS" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>development</string>
	<key>teamID</key>
	<string>$EXPO_IOS_DEVELOPMENT_TEAM</string>
</dict>
</plist>
EOF

# IPA export
echo "4. IPA export ediliyor..."
IPA_DIR="ios/build/ipa"
rm -rf "$IPA_DIR"
mkdir -p "$IPA_DIR"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$IPA_DIR" \
  -exportOptionsPlist "$EXPORT_OPTS"

# IPA'yı proje köküne kopyala
IPA_FILE=$(find "$IPA_DIR" -name "*.ipa" | head -1)
if [ -n "$IPA_FILE" ]; then
  cp "$IPA_FILE" "kindred.ipa"
  echo ""
  echo "IPA oluşturuldu: kindred.ipa"
  ls -lh kindred.ipa
else
  echo "Hata: IPA dosyası bulunamadı"
  exit 1
fi
