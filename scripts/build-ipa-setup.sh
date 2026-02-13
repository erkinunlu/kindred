#!/bin/bash
# Personal Team için: Team ID'yi Xcode'dan almak üzere projeyi hazırlar
# Önce prebuild (ios klasörü oluşur), sonra Xcode açılır - Personal Team seçin

set -e
cd "$(dirname "$0")/.."

export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer

echo "1. iOS prebuild çalıştırılıyor..."
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 CI=1 npx expo prebuild --platform ios --clean

echo "2. CocoaPods yükleniyor..."
cd ios && LANG=en_US.UTF-8 pod install && cd ..

echo ""
echo "3. Xcode açılıyor..."
echo "   → Sol taraftan 'KindRed' projesini seçin"
echo "   → 'KindRed' target'ını seçin"
echo "   → 'Signing & Capabilities' sekmesine tıklayın"
echo "   → 'Team' dropdown'dan 'Personal Team' seçin"
echo "   → Xcode'u kapatın (Cmd+Q)"
echo ""
open ios/KindRed.xcworkspace

echo "Xcode'da Personal Team'i seçip kapattıktan sonra:"
echo "  npm run build:ipa"
echo ""
