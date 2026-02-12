# GitHub'a Push Adımları

Commit'ler GitHub'a gitmiyor çünkü kimlik doğrulama gerekiyor. Aşağıdaki yöntemlerden birini kullanın:

---

## Yöntem 1: GitHub CLI (Önerilen)

Terminal'de sırayla:

```bash
cd /Users/grafik/Documents/111/kadinlar-sosyal
gh auth login
```

1. `GitHub.com` seçin
2. `HTTPS` seçin
3. `Login with a web browser` seçin
4. Çıkan kodu kopyalayıp tarayıcıda açılan sayfaya yapıştırın
5. GitHub'da giriş yapın/onaylayın

Sonra:

```bash
git push origin main
```

---

## Yöntem 2: Personal Access Token

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens**
2. **Generate new token (classic)** → repo izni verin
3. Token'ı kopyalayın
4. Terminal'de:

```bash
cd /Users/grafik/Documents/111/kadinlar-sosyal
git push https://erkinunlu:TOKEN_BURAYA@github.com/erkinunlu/kindred.git main
```

*(TOKEN_BURAYA yerine kendi token'ınızı yazın)*

---

## Yöntem 3: GitHub Desktop

1. [GitHub Desktop](https://desktop.github.com/) indirip kurun
2. **File** → **Add Local Repository** → proje klasörünü seçin
3. **Push origin** tıklayın (GitHub ile giriş yapmanız istenecek)

---

Push başarılı olduktan sonra Vercel otomatik olarak yeni deploy alacaktır.
