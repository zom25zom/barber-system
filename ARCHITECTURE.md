# معمارية نظام حجز الصالونات — Multi-Tenant SaaS

نظام SaaS متعدد المستأجرين (Multi-Tenant) لحجوزات الصالونات، مبني على:
- **API**: Cloudflare Workers + Hono + D1 (SQLite) + Queues + Durable Objects
- **Web**: Next.js (App Router) عبر OpenNext → Cloudflare Workers

---

## 1. مفهوم المستأجر (Tenant)

المستأجر = **صالون** (`salons` جدول)، ويُعرَّف بـ:
- `id` رقمي (مثلاً 1، 9، 12…) — يُخزَّن في كل الصفوف التابعة
- `slug` نصي فريد (مثلاً `salwn-alsaadh`) — يُستخدم في الروابط العامة

كل بيانات الأعمال مرتبطة بـ `salon_id`: الحلاقون، الخدمات، الحجوزات، الزبائن، الإعدادات، الإشعارات، session المالك.

## 2. مخطط تدفق هوية الصالون (ASCII)

```
┌───────────────────────────────────────────────────────────────────────┐
│                        تدفق هوية المستأجر                              │
└───────────────────────────────────────────────────────────────────────┘

  مالك جديد                       زائر / زبون
      │                                │
      ▼                                ▼
 ┌─────────┐   slug مميز    ┌─────────────────────────────────────┐
 │ /signup │──────────────► │ https://site/{salonSlug}/*          │
 └────┬────┘                │  صفحة عامة، حجز، تسجيل زبون…        │
      │ ينشئ salon          └──────────────┬──────────────────────┘
      ▼                                    │ SalonSlugProvider
 ┌──────────────────┐                      │ (Context → buildTenantUrl)
 │ MOWNER login     │                      ▼
 │ ?salonSlug=…     │            ┌─────────────────────┐
 └────┬─────────────┘            │ API: ?salonSlug=xyz │
      │                          └──────────┬──────────┘
      ▼                                     ▼
 ┌─────────────────────────────────────────────────────┐
 │              utils.ts — resolveSalon()               │
 │                                                     │
 │  مسارات القراءة (GET):   resolvePublicSalonId()      │
 │    slug → host → DEFAULT_SALON_ID fallback          │
 │                                                     │
 │  مسارات الهوية/الكتابة:  resolvePublicSalonStrict()  │
 │    slug/host مؤكد فقط + تحقق وجود الصالون           │
 │    وإلا → رفض صريح (400) بدون أي سقوط لـ id=1       │
 └────┬───────────────────────────────┬────────────────┘
      │ owner session                 │ customer session
      ▼                               ▼
 ┌──────────────┐              ┌───────────────┐
 │ /api/owner/* │              │ /api/customer/*│
 │ (scoped بالـ │              │ (scoped بالـ   │
 │  salon_id من │              │  salon_id من   │
 │  الجلسة)     │              │  الجلسة)       │
 └────┬─────────┘              └───────┬───────┘
      │          إشعارات / تذكيرات
      ▼
 ┌──────────────────────────────────────┐
 │ Cloudflare Queue → Consumer          │
 │   DO RateLimiter لكل صالون مستقل     │
 │   notify.ts يسبق روابط الزبون بـ     │
 │   /{slug}/my-bookings                │
 └──────────────────────────────────────┘
```

## 3. القاعدة الذهبية: Strict مقابل Lenient

| الدالة | الاستخدام | السلوك |
|---|---|---|
| `resolvePublicSalonId()` | **قراءة فقط** (GET) | slug → host → `DEFAULT_SALON_ID` كحل أخير؛ تضمن أن الصفحة الرئيسية تعرض شيئاً |
| `resolvePublicSalonWithSource()` | قراءة + تشخيص | يعيد `{id, source}` حيث source ∈ `'slug' \| 'host' \| null` |
| `resolvePublicSalonStrict()` | **الهوية والكتابة** (تسجيل/دخول/INSERT) | لا تعيد شيئاً إلا إذا كان slug أو host محسومين **والصالون موجود فعلاً** في DB |

**لماذا؟** الخطأ التاريخي (BUG 2): تسجيل زبون بدون سياق كان يسقط بصمت إلى `salon_id=1`.
الآن أي endpoint هوية يستخدم النسخة الصارمة ويرفض بوضوح:

```
POST /api/auth/customer/register            → 400 «تعذر تحديد الصالون…»
POST /api/auth/customer/login               → 400 إذا لم يُحدد slug صالح
POST /api/auth/customer/register?salonSlug=does-not-exist → 400
```

مسارات القراءة تبقى متسامحة عمداً حتى تعمل الصفحة الرئيسية (branding الافتراضي).

## 4. Frontend: مصدر الحقيقة الواحد للـ slug

- **`apps/web/lib/salonTenant.ts`** هو المصدر الوحيد لبناء الروابط الداخلية:
  - `buildTenantUrl(path, slugOverride?)`
  - `useTenantLink()` hook (Context أولاً، ثم سجل الوحدة كاحتياط)
- **`components/SalonSlugProvider.tsx`** يزوّد Context بالـ slug من `useParams()`
- الروابط الصلبة للمسارات الداخلية **محظورة** ويفحصها تلقائياً `scripts/check-tenant-links.mjs`
- استثناءات مقصودة: `/admin*` و `/signup` خارج نطاق الـ slug.

**منع BUG 1:** أي تنقل داخلي من `/salwn-alnkhbh/book` سيبقى تحت نفس الـ slug تلقائياً لأن جميع مكوّنات التنقل تستخدم `useTenantLink()`.

## 5. حدود معمارية معروفة (بالتصميم)

1. **لوحة الأدمن العامة** (`/admin/*`) هي session-global وليست scoped بـ slug — هذا قرار تصميمي: الأدمن يرى كل الصالونات عبر قائمة اختيار.
2. زر **«معاينة الموقع»** في Navbar داخل `/admin` يقصداً إلى الجذر `/` (لا يحمل slug).
3. `push_subscriptions.endpoint` **فريد عالمياً** (endpoint واحد = جهاز واحد) مع `ON CONFLICT` upsert.
4. **تعزيز FK منفّذ** (مهاجر `0012_customers_salon_fk.sql`):
   `FOREIGN KEY (salon_id) REFERENCES salons(id)` على `customers` — أي كتابة بصالون غير موجود تُرفض الآن على مستوى قاعدة البيانات كخط دفاع ثانٍ خلف `resolvePublicSalonStrict()`.
5. عمليات الترحيل تعاد عن بعد قبل أي نشر: `npm run migrate:remote`.

## 6. مسار طلب نموذجي (الحجز)

```
زبون ← /{slug}/book
  ├─ GET /api/barbers?salonSlug={slug}
  ├─ GET /api/barbers/:id/availability?date=…&salonSlug={slug}
  ├─ POST /api/bookings?salonSlug={slug}         (scoped)
  │     └─ queue.enqueue(notification)
  └─ (اختياري) POST /api/push/subscribe           (endpoint فريد عالمياً)

Queue consumer:
  ├─ DO per-salon rate limiting
  ├─ D1 notifications insert (type ∈ booking/cancel/reminder…)
  └─ Web Push مع URL يبدأ بـ /{slug}/my-bookings
```

## 7. الاختبارات والحرس

| الفحص | الأمر |
|---|---|
| اكتشاف روابط داخلية صلبة (BUG 1 guard) | `node scripts/check-tenant-links.mjs` |
| E2E كامل متعدد المستأجرين (82 فحصاً، 13 مرحلة) | `node scripts/e2e-multitenant.mjs` |
| تحقق Typescript للـ API | `cd apps/api && npx tsc --noEmit` |
