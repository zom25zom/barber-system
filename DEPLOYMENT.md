# دليل نشر نسخة جديدة لصالون جديد

هذا الدليل يشرح خطوات إنشاء ونشر نسخة مستقلة من النظام لصالون جديد.
الكود متطابق 100% بين جميع النسخ — فقط قاعدة البيانات وبيانات الصالون تختلف.

---

## المتطلبات

- حساب [Cloudflare](https://dash.cloudflare.com/) مفعّل
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) مثبت (`npm i -g wrangler`)
- Node.js v18+

---

## الخطوات

### 1. إنشاء قاعدة بيانات D1 جديدة

```bash
wrangler d1 create salon_<SALON_SLUG>_db
```

سيعطيك الأمر `database_id` — احفظه.

### 2. تحديث `wrangler.toml`

انسخ ملف `apps/api/wrangler.toml` وعدّل:

```toml
name = "barber-api-<SALON_SLUG>"

[[d1_databases]]
binding = "DB"
database_name = "salon_<SALON_SLUG>_db"
database_id = "<DATABASE_ID_FROM_STEP_1>"
migrations_dir = "migrations"
```

> **ملاحظة**: يمكنك استخدام `wrangler.toml` environments بدلاً من نسخ الملف:
> ```toml
> [env.salon_xyz]
> name = "barber-api-salon-xyz"
> [[env.salon_xyz.d1_databases]]
> ...
> ```

### 3. تشغيل الـ Migrations

```bash
cd apps/api

# محلياً (للاختبار)
wrangler d1 migrations apply salon_<SALON_SLUG>_db --local

# على Cloudflare (للإنتاج)
wrangler d1 migrations apply salon_<SALON_SLUG>_db --remote
```

### 4. إدخال بيانات الصالون

```bash
wrangler d1 execute salon_<SALON_SLUG>_db --remote --command \
  "UPDATE salons SET name = 'اسم الصالون', phone = '+962XXXXXXXXX', primary_color = '#f59e0b' WHERE id = 1;"
```

### 5. إنشاء حساب المدير

كلمة المرور الافتراضية `admin123` موجودة في migration `0001_init.sql`.
لتغييرها:

```bash
# أنشئ SHA-256 hash لكلمة المرور الجديدة
echo -n "YOUR_NEW_PASSWORD" | sha256sum

# حدّث في قاعدة البيانات
wrangler d1 execute salon_<SALON_SLUG>_db --remote --command \
  "UPDATE owners SET password_hash = '<SHA256_HASH>' WHERE id = 1;"
```

### 6. (اختياري) تعديل `SALON_ID`

في الوضع الحالي (single-tenant per deployment)، `SALON_ID = 1` في ملف
`apps/api/src/utils.ts` — وهو صحيح لأن كل قاعدة بيانات تحتوي صالون واحد فقط (id=1).

**لا حاجة لتغييره** إلا إذا قررت مستقبلاً تشغيل عدة صالونات على نفس قاعدة البيانات.

### 7. بناء الفرونت إند

```bash
cd apps/web
npm run build
```

### 8. نشر الـ Worker

```bash
cd apps/api
wrangler deploy
```

الـ Worker سيخدم كلاً من الـ API والملفات الثابتة (static assets) من مجلد `../web/dist`.

---

## البنية المعمارية

```
┌──────────────────────┐     ┌──────────────────────┐
│   Salon A Worker     │     │   Salon B Worker     │
│   barber-api-a       │     │   barber-api-b       │
│   SALON_ID = 1       │     │   SALON_ID = 1       │
│   ┌──────────────┐   │     │   ┌──────────────┐   │
│   │  D1: salon_a │   │     │   │  D1: salon_b │   │
│   └──────────────┘   │     │   └──────────────┘   │
└──────────────────────┘     └──────────────────────┘
         ▲                            ▲
         │         Same Code          │
         └────────────────────────────┘
```

- **الكود متطابق** في كل نسخة
- كل صالون = Worker مستقل + D1 مستقلة + Durable Object مستقل
- `SALON_ID = 1` دائماً (لأن كل D1 تحوي صالون واحد)

---

## ملاحظات مهمة

1. **VAPID Keys**: مفاتيح Web Push حالياً ثابتة في الكود (`webpush.ts`). إذا أردت مفاتيح مختلفة لكل صالون، انقلها لـ environment variables في `wrangler.toml`.

2. **النطاق (Domain)**: كل نسخة يمكن ربطها بنطاق فرعي مختلف:
   ```
   salon-a.barbershop.com → barber-api-a.workers.dev
   salon-b.barbershop.com → barber-api-b.workers.dev
   ```

3. **التحديثات**: عند تحديث الكود، أعد النشر لكل نسخة عامل:
   ```bash
   # لكل صالون
   cd apps/api && wrangler deploy --env salon_a
   cd apps/api && wrangler deploy --env salon_b
   ```

4. **المستقبل (Multi-Tenant)**: عند الاستعداد لتشغيل عدة صالونات على نفس D1:
   - غيّر `SALON_ID` ليُقرأ من environment variable أو من الـ request (مثلاً subdomain)
   - أنشئ صالونات بأرقام مختلفة في جدول `salons`
   - الكود جاهز بالفعل — كل الاستعلامات تفلتر بـ `salon_id`
