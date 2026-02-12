#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const port = 8081;
let ip = '192.168.1.106';
try {
  ip = execSync('ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 192.168.1.106', { encoding: 'utf8' }).trim();
} catch (_) {}

const expUrl = `exp://${ip}:${port}`;
const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(expUrl)}`;

const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Expo Go - Bağlantı</title>
  <style>
    body { font-family: system-ui; max-width: 400px; margin: 40px auto; padding: 24px; text-align: center; }
    h1 { font-size: 20px; margin-bottom: 20px; }
    img { width: 300px; height: 300px; margin: 20px 0; }
    a { display: block; margin-top: 20px; color: #E74C3C; word-break: break-all; }
    p { color: #6b7280; font-size: 14px; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>Expo Go ile Bağlan</h1>
  <p>1. Terminalde <code>npx expo start</code> çalışıyor olmalı</p>
  <p>2. Telefon ve bilgisayar aynı WiFi'de olmalı</p>
  <p>3. QR kodu Expo Go ile tarayın veya linke tıklayın</p>
  <img src="${qrUrl}" alt="QR Code">
  <a href="${expUrl}">${expUrl}</a>
</body>
</html>`;

const outPath = path.join(__dirname, '..', 'expo-go-dev.html');
fs.writeFileSync(outPath, html);
console.log('QR sayfası oluşturuldu:', outPath);
console.log('Expo Go linki:', expUrl);
console.log('Tarayıcıda açın: file://' + outPath);
