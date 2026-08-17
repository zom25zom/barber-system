# 🗺️ خريطة مشروع نظام الحلاقة (Barber System)

> وثيقة شاملة لفهم بنية المشروع، التقنيات، قاعدة البيانات، وآلية النشر — مُعدّة لمساعدة أي أداة AI على فهم المشروع بالكامل.

---

## 📋 نظرة عامة

| الخاصية | القيمة |
|---|---|
| **اسم المشروع** | Barber System – نظام حجز وإدارة صالون حلاقة |
| **اللغة الأساسية** | JavaScript (ES Modules) |
| **الواجهة الأمامية** | React 19 + Vite 8 |
| **الواجهة الخلفية** | Cloudflare Pages Functions (Edge Runtime) |
| **قاعدة البيانات** | Cloudflare D1 (SQLite على الحافة) |
| **النشر** | Cloudflare Pages |
| **اللغة الأساسية للمستخدمين** | العربية (RTL) |
| **بيئة التطوير المحلي** | `npm run dev` على المنفذ 3000 |

---

## 🧱 المكدس التقني (Tech Stack)

```
┌─────────────────────────────────────────────────┐
│               المتصفح / Browser                 │
│  React 19 + React Router DOM 7 + Lucide Icons  │
│              Vanilla CSS (RTL)                   │
└────────────────────┬────────────────────────────┘
                     │ fetch() calls
                     ▼
┌─────────────────────────────────────────────────┐
│         Cloudflare Pages (Edge Network)          │
│   functions/api/[[route]].js  (Edge Function)   │
│              (Node.js compat mode)               │
└────────────────────┬────────────────────────────┘
                     │ SQL queries via binding
                     ▼
┌─────────────────────────────────────────────────┐
│         Cloudflare D1 Database (SQLite)          │
│              database: "barber-db"               │
└─────────────────────────────────────────────────┘
```

### التبعيات (Dependencies)

| الحزمة | الإصدار | الغرض |
|---|---|---|
| `react` | ^19.2.8 | إطار عمل الواجهة |
| `react-dom` | ^19.2.8 | ربط React بالـ DOM |
| `react-router-dom` | ^7.18.2 | التوجيه بين الصفحات |
| `lucide-react` | ^1.31.0 | أيقونات SVG |
| `canvas-confetti` | ^1.9.4 | تأثير الاحتفال عند تأكيد الحجز |
| `vite` | ^8.2.1 | أداة البناء والتطوير |
| `@vitejs/plugin-react` | ^6.0.5 | دعم JSX في Vite |
| `wrangler` | ^4.123.0 | CLI لإدارة Cloudflare |

---

## 📁 بنية المجلدات (Directory Structure)

```
barber system/
├── index.html                    # نقطة الدخول الرئيسية (SPA)
├── vite.config.js                # إعدادات Vite (منفذ 3000، outDir: dist)
├── wrangler.jsonc                # إعدادات Cloudflare Pages + D1 binding
├── package.json                  # التبعيات والسكريبتات
├── schema.sql                    # مخطط قاعدة البيانات + البيانات الأولية
│
├── src/                          # الكود المصدري للواجهة الأمامية
│   ├── main.jsx                  # نقطة دخول React (ReactDOM.render)
│   ├── App.jsx                   # جذر التطبيق + تعريف كل المسارات
│   ├── index.css                 # الأنماط العامة (RTL, متغيرات CSS, animations)
│   │
│   ├── context/                  # React Context (إدارة الحالة العامة)
│   │   ├── AuthContext.jsx       # حالة تسجيل الدخول (أدمن + عميل)
│   │   └── SystemContext.jsx     # البيانات الحية: حلاقون، خدمات، حجوزات، إشعارات
│   │
│   ├── services/                 # طبقة خدمات البيانات
│   │   ├── api.js                # جميع استدعاءات API + Fallback للـ LocalStorage
│   │   ├── initialData.js        # البيانات الافتراضية (للوضع Offline)
│   │   └── realtime.js           # BroadcastChannel للمزامنة بين تبويبات المتصفح
│   │
│   ├── components/               # مكونات مشتركة قابلة لإعادة الاستخدام
│   │   ├── AdminNavbar.jsx       # شريط التنقل الخاص بالأدمن
│   │   ├── CustomerNavbar.jsx    # شريط التنقل الخاص بالعميل
│   │   ├── FinancialCharts.jsx   # رسوم بيانية مالية (بدون مكتبة خارجية)
│   │   ├── NotificationToast.jsx # إشعارات منبثقة (Toast)
│   │   ├── OtpModal.jsx          # نافذة التحقق برقم الهاتف (OTP)
│   │   └── StatCard.jsx          # بطاقة إحصائية للداشبورد
│   │
│   └── pages/                    # الصفحات منقسمة إلى واجهتين
│       ├── admin/                # لوحة التحكم (الأدمن/صاحب الصالون)
│       │   ├── AdminLoginPage.jsx
│       │   ├── AdminDashboardPage.jsx
│       │   ├── AdminBookingsPage.jsx
│       │   ├── AdminBarbersPage.jsx
│       │   ├── AdminServicesPage.jsx
│       │   ├── AdminCustomersPage.jsx
│       │   └── AdminReportsPage.jsx
│       │
│       └── customer/             # واجهة العميل (الحجز وتتبع الدور)
│           ├── HomeBookingPage.jsx       # الصفحة الرئيسية + اختيار الحلاق
│           ├── ServiceSelectPage.jsx     # اختيار الخدمات
│           ├── TimeSelectPage.jsx        # اختيار الوقت المتاح
│           ├── ConfirmationPage.jsx      # تأكيد الحجز (confetti animation)
│           ├── LiveQueueTrackerPage.jsx  # تتبع موقع العميل في الطابور حياً
│           └── MyBookingsPage.jsx        # سجل حجوزات العميل
│
└── functions/
    └── api/
        └── [[route]].js          # Cloudflare Edge Function (Backend كامل)
```

---

## 🗄️ قاعدة البيانات (Cloudflare D1 – SQLite)

**اسم قاعدة البيانات:** `barber-db`  
**معرّف D1:** `5562b2f0-fbcd-4e15-a096-d16f6f91c13e`  
**المتغير (Binding):** `env.DB`

### الجداول (Tables)

#### 1. `barbers` – الحلاقون
| العمود | النوع | الوصف |
|---|---|---|
| `id` | TEXT PK | معرّف فريد (مثل `b1`, `b_timestamp`) |
| `name` | TEXT | اسم الحلاق |
| `title` | TEXT | لقبه التخصصي |
| `avatar` | TEXT | رابط صورته |
| `workDays` | TEXT | JSON Array لأيام العمل `[0,1,2,3,4,5,6]` |
| `workStart` | TEXT | وقت بداية العمل `"14:00"` |
| `workEnd` | TEXT | وقت نهاية العمل `"23:00"` |
| `isOff` | INTEGER | 0 = متاح، 1 = في إجازة |
| `rating` | REAL | التقييم (4.0 – 5.0) |

#### 2. `services` – الخدمات
| العمود | النوع | الوصف |
|---|---|---|
| `id` | TEXT PK | معرّف فريد (مثل `s1`, `s_timestamp`) |
| `name` | TEXT | اسم الخدمة |
| `price` | REAL | السعر بالريال |
| `duration` | INTEGER | المدة بالدقائق |
| `category` | TEXT | التصنيف (شعر، لحية، بشرة، باقات، صبغة) |
| `description` | TEXT | وصف تفصيلي |

#### 3. `bookings` – الحجوزات
| العمود | النوع | الوصف |
|---|---|---|
| `id` | TEXT PK | رقم الحجز (مثل `bk-123456`) |
| `customerName` | TEXT | اسم العميل |
| `customerPhone` | TEXT | رقم هاتف العميل |
| `barberId` | TEXT | معرّف الحلاق |
| `serviceIds` | TEXT | JSON Array لمعرّفات الخدمات المختارة |
| `totalPrice` | REAL | السعر الإجمالي |
| `totalDuration` | INTEGER | المدة الإجمالية بالدقائق |
| `date` | TEXT | التاريخ `YYYY-MM-DD` |
| `time` | TEXT | الوقت `HH:MM` |
| `status` | TEXT | الحالة (انظر تفاصيل الحالات أدناه) |
| `createdAt` | TEXT | وقت الإنشاء (ISO 8601) |
| `notes` | TEXT | ملاحظات إضافية |

**حالات الحجز (Booking Statuses):**
- `Pending` → في الانتظار
- `Completed` → مكتمل
- `Cancelled` / `CancelledByCustomer` → ملغى من العميل
- `CancelledByOwner` → ملغى من الصالون
- `Rescheduled` → تم تعديل الموعد

#### 4. `notifications` – الإشعارات
| العمود | النوع | الوصف |
|---|---|---|
| `id` | TEXT PK | معرّف الإشعار |
| `title` | TEXT | عنوان الإشعار |
| `message` | TEXT | نص الإشعار |
| `timestamp` | TEXT | وقت الإنشاء (ISO 8601) |
| `type` | TEXT | نوعه (`new_booking`, `status_change`, `reschedule`) |
| `read` | INTEGER | 0 = غير مقروء، 1 = مقروء |
| `bookingId` | TEXT | معرّف الحجز المرتبط (اختياري) |

#### 5. `settings` – الإعدادات
| العمود | النوع | الوصف |
|---|---|---|
| `key` | TEXT PK | مفتاح الإعداد |
| `value` | TEXT | قيمته |

**الإعدادات الافتراضية:**
- `admin_password` = `admin123`

---

## 🔌 Backend API (Edge Functions)

**ملف الـ Backend:** `functions/api/[[route]].js`  
**النمط:** Wildcard Catch-all Route في Cloudflare Pages Functions

### نقاط النهاية (Endpoints)

| المسار | الطريقة | الوصف |
|---|---|---|
| `GET /api/barbers` | GET | جلب جميع الحلاقين |
| `POST /api/barbers` | POST | إضافة أو تحديث حلاق (Upsert) |
| `DELETE /api/barbers?id=X` | DELETE | حذف حلاق |
| `GET /api/services` | GET | جلب جميع الخدمات |
| `POST /api/services` | POST | إضافة أو تحديث خدمة (Upsert) |
| `DELETE /api/services?id=X` | DELETE | حذف خدمة |
| `GET /api/bookings` | GET | جلب جميع الحجوزات (مرتبة بالأحدث) |
| `POST /api/bookings` | POST | إنشاء حجز جديد |
| `PUT /api/bookings` | PUT | تحديث حالة حجز أو إعادة جدولته |
| `GET /api/notifications` | GET | جلب آخر 50 إشعار |
| `POST /api/notifications` | POST | إضافة إشعار جديد |
| `POST /api/notifications/read` | POST | تعليم إشعار (أو كل الإشعارات) كمقروء |
| `POST /api/admin/login` | POST | التحقق من كلمة مرور الأدمن |
| `POST /api/admin/change-password` | POST | تغيير كلمة مرور الأدمن |

---

## ⚡ طبقة الخدمات والمزامنة (Service Layer)

### `src/services/api.js`
الملف المركزي لجميع عمليات البيانات. يعمل بنمط **API-First مع LocalStorage Fallback**:

```
استدعاء دالة (مثلاً getBarbers())
         │
         ▼
   محاولة fetch('/api/barbers')
         │
    ┌────┴────┐
  نجح       فشل (لا إنترنت، لا D1)
    │              │
    ▼              ▼
 بيانات D1    قراءة من LocalStorage
                   + تحديث LocalStorage
```

### `src/services/realtime.js`
مزامنة في الوقت الفعلي **بين تبويبات المتصفح** عبر `BroadcastChannel API`:
- قناة الاتصال: `barber_system_realtime`
- الأحداث: `NEW_BOOKING`, `BOOKING_STATUS_CHANGED`, `BARBERS_UPDATED`, إلخ.

### `src/context/SystemContext.jsx`
- يقوم بـ **polling كل 4 ثوانٍ** لجلب البيانات المحدثة من الـ API
- يعزف **أصوات إشعارات** عبر Web Audio API عند وصول حجوزات جديدة
- يعرض **Toast Notifications** عند تغيير الحالات

---

## 🔐 نظام المصادقة (Authentication)

### أدمن (Admin)
- كلمة المرور محفوظة في جدول `settings` في D1 (أو LocalStorage كـ fallback)
- جلسة الأدمن محفوظة في `localStorage` تحت مفتاح `barber_sys_admin_session`
- **لا يوجد JWT أو Cookies** — مجرد جلسة بسيطة في localStorage

### العميل (Customer)
- تسجيل الدخول عبر **OTP وهمي** (رقم الهاتف فقط، لا يوجد خادم SMS حقيقي)
- الجلسة محفوظة في `localStorage` تحت مفتاح `barber_sys_customer_auth`
- تحتوي على: `name`, `phone`, `token` (timestamp), `loginTime`

---

## 🗺️ مسارات التطبيق (Routes)

### مسارات العميل
| المسار | الصفحة | الوصف |
|---|---|---|
| `/` | `HomeBookingPage` | الصفحة الرئيسية — اختيار الحلاق وتسجيل الدخول |
| `/booking/services` | `ServiceSelectPage` | اختيار الخدمات المطلوبة |
| `/booking/time` | `TimeSelectPage` | اختيار التاريخ والوقت المتاح |
| `/booking/confirm` | `ConfirmationPage` | مراجعة وتأكيد الحجز |
| `/queue/:bookingId` | `LiveQueueTrackerPage` | تتبع موقع العميل في الطابور حياً |
| `/my-bookings` | `MyBookingsPage` | سجل حجوزاتي (بالبحث برقم الهاتف) |

### مسارات الأدمن
| المسار | الصفحة | الوصف |
|---|---|---|
| `/admin/login` | `AdminLoginPage` | تسجيل دخول الأدمن |
| `/admin` | `AdminDashboardPage` | لوحة التحكم الرئيسية + الإحصائيات |
| `/admin/bookings` | `AdminBookingsPage` | إدارة جميع الحجوزات |
| `/admin/barbers` | `AdminBarbersPage` | إدارة الحلاقين (إضافة/تعديل/حذف) |
| `/admin/services` | `AdminServicesPage` | إدارة قائمة الخدمات والأسعار |
| `/admin/customers` | `AdminCustomersPage` | قائمة العملاء (مستخرجة من الحجوزات) |
| `/admin/reports` | `AdminReportsPage` | التقارير المالية والرسوم البيانية |

---

## 🚀 النشر والإعدادات (Deployment)

### إعدادات Cloudflare (`wrangler.jsonc`)
```json
{
  "name": "barber-system",
  "pages_build_output_dir": "./dist",
  "compatibility_date": "2024-09-23",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "barber-db",
      "database_id": "5562b2f0-fbcd-4e15-a096-d16f6f91c13e"
    }
  ]
}
```

### خطوات النشر
```bash
# 1. بناء الواجهة الأمامية
npm run build         # يُخرج ملفات في /dist

# 2. رفع قاعدة البيانات (للمرة الأولى)
npx wrangler d1 execute barber-db --file=./schema.sql --remote

# 3. نشر على Cloudflare Pages
npx wrangler pages deploy ./dist
```

### للتطوير المحلي
```bash
npm run dev           # يشغّل Vite على localhost:3000
# ملاحظة: في التطوير المحلي لا يوجد D1، لذا يعمل التطبيق تلقائياً بـ LocalStorage Fallback
```

---

## 🔄 تدفق البيانات (Data Flow)

### تدفق الحجز (Customer Flow)
```
العميل يدخل الموقع
        │
        ▼
يختار الحلاق + OTP رقم الهاتف
        │
        ▼
يختار الخدمات (ServiceSelectPage)
        │
        ▼
يختار الوقت المتاح (TimeSelectPage)
        │ [يتحقق من تعارض المواعيد محلياً]
        ▼
يؤكد الحجز → POST /api/bookings
        │
        ▼
يُنشأ إشعار تلقائياً → POST /api/notifications
        │
        ▼
يُعاد التوجيه إلى /queue/:bookingId
        │
        ▼
تتبع الطابور (polling كل 4 ثوانٍ)
```

### تدفق الأدمن (Admin Flow)
```
يسجل دخول → POST /api/admin/login
        │
        ▼
يرى الداشبورد (إحصائيات من البيانات المحلية)
        │
        ▼
يدير الحجوزات → PUT /api/bookings
        │ [يُغير الحالة: Pending → Completed/Cancelled]
        ▼
يُنشأ إشعار تلقائياً + يُبث عبر BroadcastChannel
        │
        ▼
كل التبويبات المفتوحة تحدّث نفسها فوراً
```

---

## 📐 نمط إدارة الحالة (State Management)

لا يوجد Redux أو Zustand. الحالة تُدار بـ **React Context API** فقط:

```
App.jsx
 ├── AuthProvider (AuthContext)
 │    ├── isAdmin: boolean
 │    ├── customer: { name, phone, token }
 │    └── دوال: adminLogin, adminLogout, customerLogin, customerLogout
 │
 └── SystemProvider (SystemContext)
      ├── barbers: Barber[]
      ├── services: Service[]
      ├── bookings: Booking[]
      ├── notifications: Notification[]
      ├── toastNotif: { title, message, type }
      └── دوال CRUD: saveBarber, deleteBarber, saveService, createBooking...
```

---

## 🎨 نظام التصميم (Design System)

- **الملف:** `src/index.css`
- **الحجم:** ~29KB (نظام CSS كامل)
- **الاتجاه:** RTL (العربية) بشكل افتراضي
- **التصميم:** Dark Mode، Glassmorphism، تدرجات لونية
- **الألوان الأساسية:** ذهبي `#d4a843` على خلفيات داكنة
- **الخطوط:** Google Fonts (Tajawal للعربية)
- **المتغيرات:** CSS Custom Properties في `:root`

---

## ⚠️ ملاحظات مهمة للـ AI

1. **نمط Upsert:** الـ API لا يفرّق بين INSERT و UPDATE — إذا كان `id` موجوداً يُحدَّث، وإلا يُنشأ جديد.
2. **Fallback تلقائي:** إذا فشل أي استدعاء API، يعمل التطبيق بـ LocalStorage تلقائياً دون أي خطأ ظاهر للمستخدم.
3. **التواريخ:** يُستخدم التوقيت المحلي للمستخدم (`getLocalDateStr()`) وليس UTC.
4. **طابور الانتظار:** يُحسَب من الحجوزات ذات الحالة `Pending` أو `Rescheduled` فقط.
5. **OTP:** النظام لا يرسل SMS حقيقياً — رقم التحقق وهمي (يُعرض مباشرة في الواجهة).
6. **لا يوجد خادم مخصص:** الـ Backend كله في ملف واحد (Edge Function) يعمل على شبكة Cloudflare.
7. **مفاتيح LocalStorage:** البيانات مخزنة بمفاتيح تبدأ بـ `barber_sys_`.
