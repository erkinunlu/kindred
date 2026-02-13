# Push Bildirimleri Kurulumu

## 1. Migration

```bash
npx supabase db push
```

## 2. Edge Function Deploy

```bash
supabase functions deploy send-push
```

## 3. Database Webhook (Supabase Dashboard)

Push bildirimlerinin gönderilmesi için Database Webhook ekleyin:

1. [Supabase Dashboard](https://supabase.com/dashboard) → Projeniz → **Database** → **Webhooks**
2. **Create a new hook**
3. **Name:** `notifications-push`
4. **Table:** `notifications`
5. **Events:** `Insert`
6. **Type:** `HTTP Request`
7. **URL:** `https://<PROJECT_REF>.supabase.co/functions/v1/send-push`
   - `<PROJECT_REF>` yerine proje ID'nizi yazın (Settings → General)
8. **HTTP Headers:** `Content-Type: application/json`
9. **HTTP Method:** `POST`

Kaydedin. Artık `notifications` tablosuna her INSERT olduğunda Edge Function çağrılacak ve push gönderilecek.

## 4. Test

- Uygulamada bildirim izni verin
- Başka bir kullanıcıyla mesajlaşın veya eşleşin
- Telefonda push bildirimi almalısınız
