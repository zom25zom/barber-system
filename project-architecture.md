# 🏗️ معمارية المشروع — Barbershop Booking System

نظام متكامل لحجز مواعيد الصالونات (SaaS متعدد المستأجرين) مبني بالكامل على بنية **Serverless** من Cloudflare — بدون أي خوادم تقليدية.

---

## 1. نظرة عامة

| العنصر | الوصف |
|---|---|
| **نوع النظام** | SaaS متعدد المستأجرين (Multi-Tenant) — كل صالون ببياناته المعزولة داخل قاعدة بيانات واحدة |
| **الواجهة الأمامية** | Next.js 15 (App Router, SSR) — تُشغَّل على Cloudflare Workers عبر OpenNext |
| **الواجهة الخلفية (API)** | Hono على Cloudflare Workers |
| **قاعدة البيانات** | Cloudflare D1 (SQLite) |
| **الملفات والصور** | Cloudflare R2 (مع fallback لتخزين D1) |
| **الإشعارات الفورية** | WebSocket عبر Durable Objects + Web Push (VAPID) |
| **التذكيرات المجدولة** | Cloudflare Queues (رسائل مؤجلة قبل الموعد بـ 20 دقيقة) |
| **النشر** | Wrangler CLI — Worker منفصل للـ API وWorker منفصل للـ Web |

```
                        ┌─────────────────────────────┐
                        │        Cloudflare Edge       │
                        │                              │
   الزبون ──────────────▶   barber-web  (SSR Worker)    │
                        │   Next.js via OpenNext       │
                        │        │  /api/*             │
                        │        ▼                     │
                        │   barber-api (Worker)        │──▶ D1 (SQLite)
                        │   Hono + CORS                │──▶ R2 (الصور)
                        │        │                     │──▶ Queues (التذكيرات)
                        │        ▼                     │──▶ Durable Objects (WS)
                        │   NotificationHub (DO)       │
                        └─────────────────────────────┘
```

---

## 2. هيكل المشروع (Directory Tree)

```
barber system/
├── apps/
│   ├── api/                          # ── الواجهة الخلفية (Worker)
│   │   ├── src/
│   │   │   ├── index.ts              # نقطة الدخول: Hono app + CORS + WS hub + Queues consumer
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts           # تسجيل الدخول (أدمن + زبون) والتسجيل الذاتي للصالونات
│   │   │   │   ├── public.ts         # endpoints عامة (الحلاقين، التوفر، إعدادات الصالون)
│   │   │   │   ├── owner.ts          # لوحة التحكم: الحجوزات، الحلاقين، التقارير، الإعدادات
│   │   │   │   ├── customer.ts       # حجوزات الزبون، الدور المباشر، الإشعارات، الملف الشخصي
│   │   │   │   ├── push.ts           # اشتراكات Web Push
│   │   │   │   └── upload.ts         # رفع الصور (R2 مع fallback لـ D1)
│   │   │   ├── durable.ts            # NotificationHub — Durable Object لعزل WebSocket لكل صالون
│   │   │   ├── reminders.ts          # معالج رسائل التذكير من الـ Queue
│   │   │   ├── notify.ts             # إنشاء الإشعارات + بثها الحي
│   │   │   ├── webpush.ts            # إرسال Web Push (مفاتيح VAPID)
│   │   │   ├── cleanup.ts            # تنظيف دوري
│   │   │   ├── utils.ts              # دوال مشتركة (توقيت الأردن UTC+3، حساب الصالون العام)
│   │   │   └── types.ts
│   │   ├── migrations/               # 12 migration لتطوير قاعدة البيانات
│   │   │   ├── 0001_init.sql         # الجداول الأساسية + حساب الأدمن الافتراضي
│   │   │   ├── 0002_push_subscriptions.sql
│   │   │   ├── 0003_multi_tenant_ready.sql
│   │   │   ├── 0004_barber_flexibility.sql
│   │   │   ├── 0005_uploads.sql
│   │   │   ├── 0006_salon_social_and_maps.sql
│   │   │   ├── 0007_customer_passwords.sql
│   │   │   ├── 0008_multi_tenant_sessions.sql
│   │   │   ├── 0009_self_service_signup.sql
│   │   │   ├── 0010_multi_tenant_customers.sql
│   │   │   ├── 0011_notification_reminder_type.sql
│   │   │   └── 0012_customers_salon_fk.sql
│   │   └── wrangler.toml             # إعدادات نشر الـ API (D1 + R2 + Queues + DO)
│   │
│   └── web/                          # ── الواجهة الأمامية (Next.js SSR)
│       ├── app/
│       │   ├── layout.tsx            # الجذر: RTL + الخطوط + Navbar + Toaster
│       │   ├── globals.css           # نظام التصميم: tokens + طبقة "premium barbershop editorial"
│       │   ├── page.tsx              # الصفحة الرئيسية العامة
│       │   ├── book/ · login/ · register/ · my-bookings/ · my-profile/ · notifications/
│       │   ├── signup/               # تسجيل صالون جديد ذاتياً (SaaS onboarding)
│       │   ├── [salonSlug]/          # صفحات الصالون المستأجر (SSR عند الطلب) + /admin/login
│       │   └── admin/                # لوحة تحكم الأدمن
│       │       ├── layout.tsx + AdminClientLayout.tsx   # Sidebar (ديسكتوب) + Bottom bar (موبايل)
│       │       ├── page.tsx          # لوحة الإحصائيات (hero metric + مخطط أسبوعي)
│       │       ├── bookings/         # إدارة الحجوزات + الحجز اليدوي
│       │       ├── barbers/          # الحلاقين + services/ + schedule/ (الجداول والإجازات والاستراحات)
│       │       ├── reports/          # التقارير المالية + خريطة ساعات الذروة (Heatmap) + CSV
│       │       ├── settings/ · profile/ · notifications/ · health/ · login/
│       ├── components/
│       │   ├── pages/                # مكونات الصفحات (Home/Book/Login/Register/MyBookings/MyProfile/Notifications)
│       │   ├── ui/                   # عناصر shadcn/ui (Button, Card, Input, Select, Dialog…)
│       │   ├── Navbar.tsx            # رأس مزدوج (فرع زبائن + فرع أدمن)
│       │   ├── CustomerBottomBar.tsx # شريط تنقل سفلي عائم للزبائن
│       │   ├── BookingCountdown.tsx  # العداد التنازلي لدور الحجز
│       │   ├── ConfirmModal.tsx · Toaster.tsx · Spinner.tsx · ImageUploader.tsx
│       │   └── InstallPrompt.tsx · IOSInstallGuide.tsx · ThemeToggle.tsx · PushDiagnostics.tsx
│       ├── lib/                      # طبقة الربط والمنطق المشترك
│       │   ├── api.ts                # apiFetch + API_BASE (منفصل للأخطاء بالعربية)
│       │   ├── auth.ts               # جلسات الزبون والمالك (منفصلة تماماً)
│       │   ├── salon.ts · salonTenant.ts   # إعدادات الصالون + مساعدات روابط المستأجر (withSlug/useTenantLink)
│       │   ├── time.ts               # التوقيت (الأردن UTC+3) والتنسيقات
│       │   ├── push.ts · useNotifications.ts · audio.ts   # الإشعارات والصوت
│       │   └── types.ts · utils.ts
│       ├── next.config.ts            # SSR (بدون static export) — الصالونات الجديدة تعمل فوراً
│       ├── open-next.config.ts       # إعداد OpenNext → Cloudflare
│       └── wrangler.jsonc            # إعدادات نشر barber-web
│
├── scripts/
│   ├── e2e-multitenant.mjs           # 110 اختبار عزل متعدد المستأجرين (مقابل wrangler dev)
│   └── check-tenant-links.mjs        # فحص ثبات الروابط (منع الروابط الداخلية المكتوبة يدوياً)
│
├── ARCHITECTURE.md · DEPLOYMENT.md · PRD-Barbershop-Booking-System.md · README.md
└── project-architecture.md           # ← هذا الملف
```

---

## 3. التقنيات والأطر المستخدمة

### الواجهة الأمامية (`apps/web`)
| التقنية | الإصدار | الاستخدام |
|---|---|---|
| **Next.js** | 15.5 (App Router) | React framework — SSR ديناميكي لصفحات `/{salonSlug}` |
| **React** | 19.1 | مكتبة الواجهة |
| **TypeScript** | 5.x | في كل المشروع |
| **Tailwind CSS** | 4.1 (CSS-first `@theme`) | نظام التنسيق + Design Tokens (`--bs-*`) |
| **shadcn/ui + Radix** | — | عناصر الواجهة (Dialog, Select, …) |
| **lucide-react** | — | الأيقونات |
| **next-themes** | — | الوضع الفاتح/الداكن |
| **sonner** | — | التنبيهات (Toasts) |
| **@opennextjs/cloudflare** | 1.20 | تحويل Next.js إلى Cloudflare Worker (SSR) |
| **الخطوط** | IBM Plex Sans Arabic + Inter | نظام طباعي عربي/لاتيني |

### الواجهة الخلفية (`apps/api`)
| التقنية | الإصدار | الاستخدام |
|---|---|---|
| **Hono** | 4.6 | إطار الـ API على Workers (router + middleware CORS) |
| **Cloudflare Workers** | — | بيئة تشغيل الـ API (edge serverless) |
| **Cloudflare D1** | — | قاعدة بيانات SQLite مع `prepare/bind` |
| **Cloudflare R2** | — | تخزين صور الصالونات والشعارات (fallback: D1 blobs) |
| **Cloudflare Queues** | — | تذكيرات مؤجلة (`booking-reminders`) قبل الموعد بـ 20 دقيقة |
| **Durable Objects** | — | `NotificationHub` — غرفة WebSocket معزولة لكل صالون (`salon-{id}`) |
| **wrangler** | 4.12x | CLI البناء والنشر والتطوير المحلي |
| **@block65/webcrypto-web-push** | — | Web Push (VAPID) |

### أدوات الجودة
| الأداة | الوظيفة |
|---|---|
| `scripts/e2e-multitenant.mjs` | 110 اختبار عزل: جلسات، حجوزات متزامنة، WebSocket، تذكيرات، تقارير، رفع صور، هجمات عابرة للمستأجرين |
| `scripts/check-tenant-links.mjs` | فحص أستاتيكي يمنع الروابط الداخلية الثابتة خارج مساعدات `useTenantLink` |

---

## 4. قاعدة البيانات (D1)

جداول رئيسية: `salons` · `owners` · `barbers` · `services` · `barber_schedules` · `barber_time_off` · `barber_breaks` · `bookings` · `booking_services` · `customers` · `notifications` · `push_subscriptions` · `uploads`

**مبدأ العزل (Multi-Tenancy):**
- كل الصالونات داخل قاعدة بيانات واحدة، وكل صف يحمل `salon_id`
- كل استعلام في الـ API يُفلتر بـ `salon_id` المستخرج من الجلسة (owner token) أو من `?salonSlug=` (مسارات عامة)
- جلسة الأدمن مرتبطة بالصالون server-side منذ تسجيل الدخول (`/api/auth/owner/login` يحدد الصالون من اسم المستخدم وكلمة المرور — لا يُوثق بأي معرّف يأتي من العميل)
- أسماء مستخدمي الأدمن وأرقام هواتف الزبائن فريدة **لكل صالون** وليس عالمياً

---

## 5. الاستضافة

كل شيء مستضاف على **Cloudflare** (حساب: Nawafzwd25@gmail.com):

| المورد | الاسم | الرابط |
|---|---|---|
| Web Worker (SSR) | `barber-web` | `https://barber-web.nawafzwd25.workers.dev` |
| API Worker | `barber-api` | `https://barber-api.nawafzwd25.workers.dev` |
| قاعدة البيانات | `barber_db` (D1) | `database_id: f9d5777a-…` |
| التخزين | `barber-uploads` (R2) | ربط عبر binding `BUCKET` |
| الطابور | `booking-reminders` (Queues) | producer + consumer في نفس الـ Worker |
| Durable Object | `NotificationHub` | `new_sqlite_classes` (migration tag `v1`) |

الـ Web هو نقطة دخول المستخدم؛ نداءات `/api/*` تُرسل مباشرة إلى نطاق الـ API Worker عبر `NEXT_PUBLIC_API_BASE_URL` المدمج وقت البناء (CORS مفتوح في الـ API).

---

## 6. طريقة النشر (Deployment)

### المتطلبات
- حساب Cloudflare + تسجيل دخول: `npx wrangler login` (OAuth)
- Node.js 18+

### أ) تحديث الـ API (عند تعديل `apps/api`)
```bash
cd apps/api
npx wrangler d1 migrations apply barber_db --remote   # المigrations أولاً (آمن للتكرار)
npx wrangler deploy                                    # نشر barber-api
```

### ب) تحديث الـ Web (عند تعديل `apps/web`)
```bash
cd apps/web
NEXT_PUBLIC_API_BASE_URL="https://barber-api.nawafzwd25.workers.dev" \
  npx opennextjs-cloudflare build                      # next build + تحويل إلى Worker
npx wrangler deploy                                    # نشر barber-web
```
> ⚠️ `NEXT_PUBLIC_API_BASE_URL` تُدمج في ملفات JS وقت البناء — أي تغيير في عنوان الـ API يتطلب إعادة بناء الـ Web.

### ج) بيئة التطوير المحلية
```bash
cd apps/api  && npx wrangler d1 migrations apply barber_db --local && npx wrangler dev   # API على :8787
cd apps/web  && npm run dev                                                              # Next على :3000
```

### د) خطوة التحقق قبل/بعد أي نشر واجهة (إلزامية)
```bash
node scripts/check-tenant-links.mjs    # فحص ثبات الروابط
node scripts/e2e-multitenant.mjs       # 95/110 اختبار عزل — يجب أن ينجح بالكامل (يتطلب wrangler dev شغّالاً)
```

### هـ) إضافة صالون جديد (SaaS)
لا يحتاج أي نشر — الصالون يسجل نفسه ذاتياً من صفحة `/signup`، وصفحاته تُقدَّم فوراً عبر `/{salonSlug}` (SSR عند الطلب).

---

## 7. قرارات معمارية مهمة

1. **فصل جلسات الزبون والمالك** — token منفصلان ومخازن منفصلة (`lib/auth.ts`)؛ لا تسريب ممكن بين النظامين.
2. **روابط المستأجر مركزية** — كل مكون يُعرض داخل `/{salonSlug}` يجب أن يبني روابطه عبر `useTenantLink`/`withSlug` فقط (يفرضها `check-tenant-links.mjs`).
3. **الوقت بالتوقيت الأردني (UTC+3)** — حسابات "اليوم" و"التوفر" تُمرر `clientTime` من العميل لتفادي انزياح المناطق الزمنية.
4. **عزل WebSocket بالمستأجر** — كل صالون له Durable Object مستقل باسم `salon-{salon_id}`؛ إشعارات صالون لا تصل أبداً لصالون آخر (مغطى بالاختبارات).
5. **SSR بدون ISR/cache** — الصفحات تُجلب بياناتها client-side (`cache: no-store`)، لذلك لا حاجة لـ Incremental Cache في OpenNext.
6. **نظام التصميم الموحد** — طبقة "premium barbershop editorial" في `globals.css` (`.bs-skin`, `.bs-panel`, `.bs-grain`, `.bs-hairline`, `.bs-leader`) تُطبَّق فقط على صفحات العملاء ولوحة الأدمن، مع دعم الوضعين الفاتح والداكن عبر `--bs-*` tokens.
