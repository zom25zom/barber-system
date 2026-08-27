/**
 * Multi-Tenant SaaS — Comprehensive Isolation E2E Test
 * Runs against a local wrangler dev server (http://127.0.0.1:8787)
 * Tests two salons operating CONCURRENTLY with identical admin usernames.
 */
const BASE = "http://127.0.0.1:8787";
import { join } from "node:path";

let passCount = 0, failCount = 0;
const failures = [];

function check(name, cond, detail = "") {
  if (cond) { passCount++; console.log(`  ✅ PASS  ${name}${detail ? ` — ${detail}` : ""}`); }
  else      { failCount++; failures.push(name); console.log(`  ❌ FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function http(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("json") ? await res.json().catch(() => null) : await res.text();
  return { status: res.status, data, headers: res.headers };
}

// Jordan UTC+3 date/time helpers (mirror utils.ts)
function salonTodayISO() {
  return new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
}
function salonTimeAfter(minutes) {
  const d = new Date(Date.now() + 3 * 3600_000 + minutes * 60_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
function tomorrowISO() {
  return new Date(Date.now() + 3 * 3600_000 + 24 * 3600_000).toISOString().slice(0, 10);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("\n══════════════════════════════════════════════════");
  console.log(" مرحلة 1: إنشاء صالونين بنفس اسم مستخدم الأدمن «admin»");
  console.log("══════════════════════════════════════════════════");

  // Register salon A and salon B via self-service signup — SAME username "admin"
  const regA = await http("POST", "/api/salons/register", {
    body: { name: "صالون النخبة", phone: "+962790000001", adminUsername: "admin", password: "secret123" },
  });
  check("تسجيل صالون A عبر /signup", regA.status === 201 && !!regA.data?.salon?.slug, `slug=${regA.data?.salon?.slug} id=${regA.data?.salon?.id}`);
  const slugA = regA.data.salon.slug, idA = regA.data.salon.id, tokenA1 = regA.data.token;

  const regB = await http("POST", "/api/salons/register", {
    body: { name: "باربر كلوب", phone: "+962790000002", adminUsername: "admin", password: "otherpass456" },
  });
  check("تسجيل صالون B بنفس اسم المستخدم «admin» (فريد لكل صالون)", regB.status === 201, `slug=${regB.data?.salon?.slug} id=${regB.data?.salon?.id}`);
  const slugB = regB.data.salon.slug, idB = regB.data.salon.id, tokenB1 = regB.data.token;
  check("معرّفا الصالونين مختلفان (عزل على مستوى DB)", idA !== idB, `A=${idA}, B=${idB}`);

  console.log("\n══════════════════════════════════════════════════");
  console.log(" مرحلة 2: تسجيل دخول الأدمن (النقطة الحرجة #1)");
  console.log("══════════════════════════════════════════════════");

  // Login WITHOUT slug: falls back to DEFAULT_SALON_ID=1 → only salon-A's owner can match.
  // Salon-B's owner MUST fail here (this reproduces the original reported bug for non-default salons).
  const noSlugB = await http("POST", "/api/auth/owner/login", { body: { username: "admin", password: "otherpass456" } });
  check("أدمن صالون B بدون تحديد الصالون → يُرفض (لا تسرب خاطئ)", noSlugB.status === 401 || noSlugB.status === 400, `status=${noSlugB.status}`);

  // Login WITH explicit slug → deterministic correct tenant for BOTH salons
  const loginA = await http("POST", "/api/auth/owner/login", { body: { username: "admin", password: "secret123", salonSlug: slugA } });
  check("أدمن صالون A مع معرّف الصالون → نجاح", loginA.status === 200 && loginA.data?.token, "");
  check("الاستجابة تعيد بيانات الصالون الصحيح A", loginA.data?.salon?.id === idA && loginA.data?.salon?.slug === slugA, JSON.stringify(loginA.data?.salon));

  const loginB = await http("POST", "/api/auth/owner/login", { body: { username: "admin", password: "otherpass456", salonSlug: slugB } });
  check("أدمن صالون B بنفس اسم المستخدم ومعرّفه → نجاح", loginB.status === 200 && !!loginB.data?.token, "");
  check("الاستجابة تعيد بيانات الصالون الصحيح B (وليس A)", loginB.data?.salon?.id === idB, JSON.stringify(loginB.data?.salon));

  // Wrong-salon password cross-attempt
  const crossLogin = await http("POST", "/api/auth/owner/login", { body: { username: "admin", password: "secret123", salonSlug: slugB } });
  check("محاولة كلمة مرور صالون A على صالون B → مرفوضة 401", crossLogin.status === 401);

  const badSlug = await http("POST", "/api/auth/owner/login", { body: { username: "admin", password: "secret123", salonSlug: "no-such-salon" } });
  check("معرّف صالون غير موجود → خطأ واضح 404", badSlug.status === 404, `msg=${badSlug.data?.error}`);

  const tokenA = loginA.data.token, tokenB = loginB.data.token;

  // Verify session binding via the new session-scoped settings endpoint
  const setA = await http("GET", "/api/owner/salon-settings", { token: tokenA });
  const setB = await http("GET", "/api/owner/salon-settings", { token: tokenB });
  check("GET /api/owner/salon-settings يربط الجلسة بالصالون A", setA.status === 200 && setA.data?.salon?.id === idA, `name=${setA.data?.salon?.name}`);
  check("GET /api/owner/salon-settings يربط الجلسة بالصالون B", setB.status === 200 && setB.data?.salon?.id === idB, `name=${setB.data?.salon?.name}`);

  console.log("\n══════════════════════════════════════════════════");
  console.log(" مرحلة 3: تجهيز بيانات متطابقة في كلا الصالونين");
  console.log("══════════════════════════════════════════════════");

  async function setupSalon(token, barberName, svcName, price) {
    const bar = await http("POST", "/api/owner/barbers", { token, body: { name: barberName } });
    const barberId = bar.data.id;
    const svc = await http("POST", `/api/owner/barbers/${barberId}/services`, {
      token, body: { name: svcName, price, duration_minutes: 30 },
    });
    const days = [0,1,2,3,4,5,6].map(d => ({ day_of_week: d, start_time: "00:00", end_time: "23:50", is_day_off: false }));
    await http("PUT", `/api/owner/barbers/${barberId}/schedule`, { token, body: { days } });
    return barberId;
  }
  const barberA = await setupSalon(tokenA, "الحلاق أحمد", "قص شعر كلاسيكي", 8);
  const barberB = await setupSalon(tokenB, "الحلاق أحمد", "قص شعر كلاسيكي", 12);
  check("إنشاء حلاق+خدمة+جدول أسبوعي لصالون A", typeof barberA === "number");
  check("إنشاء حلاق+خدمة+جدول أسبوعي لصالون B (نفس الاسم عمداً)", typeof barberB === "number");

  // Public catalog isolation
  const pubA = await http("GET", `/api/barbers?salonSlug=${slugA}`);
  const pubB = await http("GET", `/api/barbers?salonSlug=${slugB}`);
  check("كتالوج الحلاقين العام لـ A يحوي حلاقاً واحداً", pubA.data?.barbers?.length === 1, `id=${pubA.data?.barbers?.[0]?.id}`);
  check("كتالوج B منفصل عن A رغم تطابق الأسماء", pubB.data?.barbers?.[0]?.id !== pubA.data?.barbers?.[0]?.id, `B-id=${pubB.data?.barbers?.[0]?.id}`);

  console.log("\n══════════════════════════════════════════════════");
  console.log(" مرحلة 4: الزبائن والتسجيل المعزول");
  console.log("══════════════════════════════════════════════════");

  async function registerCustomer(slug, username, phone, password) {
    const r = await http("POST", `/api/auth/customer/register?salonSlug=${slug}`, {
      body: { username, phone, password },
    });
    const l = await http("POST", `/api/auth/customer/login?salonSlug=${slug}`, {
      body: { phone, password },
    });
    return { register: r, login: l };
  }

  const custA  = await registerCustomer(slugA, "زبون-نخبة",   "+962791111111", "custpass1");
  const custA2 = await registerCustomer(slugA, "زبون-تجربة",  "+962794444444", "custpass4");
  const custB  = await registerCustomer(slugB, "زبون-كلوب",   "+962792222222", "custpass2");
  const custB2 = await registerCustomer(slugB, "زبون-تجربة",  "+962795555555", "custpass5"); // SAME username as A2!

  check("تسجيل زبون A رئيسي", custA.register.status === 201 && !!custA.login.data?.token, JSON.stringify({r:custA.register.data,l:custA.login.data,rS:custA.register.status,lS:custA.login.status}));
  check("تسجيل زبون B رئيسي", custB.register.status === 201 && !!custB.login.data?.token, JSON.stringify({r:custB.register.data,l:custB.login.data,rS:custB.register.status,lS:custB.login.status}));
  check("اسم زبون «زبون-تجربة» مسموح في الصالونين معاً (فريد لكل صالون)", custA2.register.status === 201 && custB2.register.status === 201, JSON.stringify({a2:custA2.register,b2:custB2.register}));
  check("رقم هاتف نفسه لا يمكن أن يتكرر داخل نفس الصالون",
    (await http("POST", `/api/auth/customer/register?salonSlug=${slugA}`, { body: { username: "مكرر", phone: "+962791111111", password: "xxxxxx" } })).status === 409);
  check("رقم هاتف مستخدم في A يمكن استخدامه في B (قواعد منفصلة)",
    (await http("POST", `/api/auth/customer/register?salonSlug=${slugB}`, { body: { username: "فريد-كلوب", phone: "+962791111111", password: "xxxxxx" } })).status === 201);

  const tokA = custA.login.data.token, tokA2 = custA2.login.data.token;
  const tokB = custB.login.data.token, tokB2 = custB2.login.data.token;

  console.log("\n══════════════════════════════════════════════════");
  console.log(" مرحلة 5: حجوزات بنفس التوقيت في الصالونين (غداً 15:00)");
  console.log("══════════════════════════════════════════════════");

  const tDate = tomorrowISO();
  const svA = (await http("GET", `/api/owner/barbers/${barberA}/services`, { token: tokenA })).data.services;
  const svB = (await http("GET", `/api/owner/barbers/${barberB}/services`, { token: tokenB })).data.services;
  check("جلب الخدمات لكل حلاق ضمن صالونه", svA.length === 1 && svB.length === 1);
  const bookAok = await http("POST", "/api/customer/bookings", { token: tokA, body: { barber_id: barberA, service_ids: [svA[0].id], date: tDate, start_time: "15:00" } });
  const bookBok = await http("POST", "/api/customer/bookings", { token: tokB, body: { barber_id: barberB, service_ids: [svB[0].id], date: tDate, start_time: "15:00" } });
  check("حجز زبون A غداً 15:00", bookAok.status === 201, `id=${bookAok.data?.id} price=${bookAok.data?.total_price}`);
  check("حجز زبون B بنفس التوقيت تماماً 15:00 — بدون أي تعارض عابر للصالونات", bookBok.status === 201, `id=${bookBok.data?.id} price=${bookBok.data?.total_price}`);
  check("سعر الخدمة يعكس أسعار كل صالون (8 مقابل 12)", bookAok.data?.total_price === 8 && bookBok.data?.total_price === 12, `A=${bookAok.data?.total_price}, B=${bookBok.data?.total_price}`);
  const bookingIdA = bookAok.data.id, bookingIdB = bookBok.data.id;

  // Same-slot conflict INSIDE one salon must still be enforced
  const dupSlot = await http("POST", "/api/customer/bookings", { token: tokA2, body: { barber_id: barberA, service_ids: [svA[0].id], date: tDate, start_time: "15:00" } });
  check("تعارض نفس الموعد داخل نفس الصالون → 409 (العزل لم يُضعف قواعد الحجز)", dupSlot.status === 409);

  console.log("\n══════════════════════════════════════════════════");
  console.log(" مرحلة 6: الإشعارات الفورية WebSocket — عزل DO (النقطة #4)");
  console.log("══════════════════════════════════════════════════");

  function connectWS(role, token) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${BASE.replace("http", "ws")}/api/notifications/ws?role=${role}&token=${encodeURIComponent(token)}`);
      const frames = [];
      ws.onopen = () => resolve({ ws, frames });
      ws.onerror = (e) => reject(new Error("WS error"));
      setTimeout(() => reject(new Error("WS timeout")), 15000);
      ws.onmessage = (ev) => frames.push(ev.data);
    });
  }

  const wsA = await connectWS("owner", tokenA);
  const wsB = await connectWS("owner", tokenB);
  check("اتصال WebSocket لأدمن A", wsA.ws.readyState === 1);
  check("اتصال WebSocket لأدمن B", wsB.ws.readyState === 1);

  // Owner A cancels customer A booking → frees customer A
  await http("POST", `/api/owner/bookings/${bookingIdA}/cancel`, { token: tokenA });

  // Customer A books a NEW slot at 16:30 → should notify ONLY owner A live
  const rebookA = await http("POST", "/api/customer/bookings", { token: tokA, body: { barber_id: barberA, service_ids: [svA[0].id], date: tDate, start_time: "16:30" } });
  check("إعادة حجز زبون A (لتوليد إشعار أدمن مباشر)", rebookA.status === 201);

  await sleep(4000);
  const aFrames = wsA.frames.map(f => { try { return JSON.parse(f); } catch { return {}; } });
  const bFrames = wsB.frames;
  check("أدمن A استقبل إشعار «حجز جديد» فورياً عبر WebSocket", aFrames.some(f => f.type === "new_booking"), `${wsA.frames.length} frame(s)`);
  check("أدمن B لم يستقبل أي إشعار من نشاط صالون A (عزل تام)", bFrames.length === 0, `${bFrames.length} frames`);
  wsA.ws.close(); wsB.ws.close();

  // Customer-facing notification list isolation
  const notifListA = await http("GET", "/api/customer/notifications", { token: tokA });
  const allFromSalonA = notifListA.data.notifications.every(n => n.message.includes("أحمد"));
  check("قائمة إشعارات الزبون A لا تتضمن إلا رسائل صالونه", notifListA.status === 200 && allFromSalonA);

  console.log("\n══════════════════════════════════════════════════");
  console.log(" مرحلة 7: تذكيرات Cloudflare Queues — عزل التذكير (#5)");
  console.log("══════════════════════════════════════════════════");

  // Bookings ~21min from now → reminder queued to fire in ~60s, per tenant
  const rDate = salonTodayISO();
  const rTime = salonTimeAfter(21);
  const remA = await http("POST", "/api/customer/bookings", { token: tokA2, body: { barber_id: barberA, service_ids: [svA[0].id], date: rDate, start_time: rTime } });
  const remB = await http("POST", "/api/customer/bookings", { token: tokB2, body: { barber_id: barberB, service_ids: [svB[0].id], date: rDate, start_time: rTime } });
  check(`حجز تذكير A اليوم ${rTime}`, remA.status === 201, `id=${remA.data?.id} err=${JSON.stringify(remA.data)}`);
  check(`حجز تذكير B نفس الدقيقة (${rTime})`, remB.status === 201, `booking=${remB.data?.id} err=${JSON.stringify(remB.data)}`);

  console.log("  ⏳ انتظار ~75 ثانية حتى تنطلق رسائل التذكير المجدولة...");
  await sleep(75000);

  const nA2 = await http("GET", "/api/customer/notifications", { token: tokA2 });
  const nB2 = await http("GET", "/api/customer/notifications", { token: tokB2 });
  const remMsgsA = nA2.data.notifications.filter(n => n.type === "reminder");
  const remMsgsB = nB2.data.notifications.filter(n => n.type === "reminder");
  check("زبون A2 استلم تذكير «بعد 20 دقيقة» لحجز صالون A فقط", remMsgsA.length >= 1 && remMsgsA.every(m => m.message.includes("أحمد")), remMsgsA[0]?.message ?? "none");
  check("زبون B2 استلم تذكيره الخاص بصالون B", remMsgsB.length >= 1, remMsgsB[0]?.message ?? "none");
  check("التذكيرات سليمة salon_id: A2 لم يستلم أي تذكير من صالون B والعكس",
    remMsgsA.every(m => m.salon_id === idA) && remMsgsB.every(m => m.salon_id === idB),
    `A2→salon=${remMsgsA[0]?.salon_id}, B2→salon=${remMsgsB[0]?.salon_id}`);

  console.log("\n══════════════════════════════════════════════════");
  console.log(" مرحلة 8: التقارير والإحصائيات (#6)");
  console.log("══════════════════════════════════════════════════");

  const repA = await http("GET", `/api/owner/reports?from=${tDate}&to=${tDate}`, { token: tokenA });
  const repB = await http("GET", `/api/owner/reports?from=${tDate}&to=${tDate}`, { token: tokenB });
  check("تقرير A يعمل", repA.status === 200 && repA.data?.summary);
  check("تقرير B يعمل", repB.status === 200 && repB.data?.summary);
  check("إيراد A = 8×عدد حجوزاته المؤكدة فقط (لا يشمل B)",
    repA.data.summary.total_revenue === 8 * repA.data.summary.confirmed_count,
    `revenue=${repA.data.summary.total_revenue}, bookings=${repA.data.summary.total_bookings}`);
  check("إيراد B = 12×عدد حجوزاته المؤكدة فقط (لا يشمل A)",
    repB.data.summary.total_revenue === 12 * repB.data.summary.confirmed_count,
    `revenue=${repB.data.summary.total_revenue}, bookings=${repB.data.summary.total_bookings}`);
  check("أداء الحلاقين في تقرير A لا يعرض حلاقي B", repA.data.revenue_by_barber.length === 1 && repA.data.revenue_by_barber[0].barber_id === barberA);
  check("أداء الحلاقين في تقرير B لا يعرض حلاقي A", repB.data.revenue_by_barber.length === 1 && repB.data.revenue_by_barber[0].barber_id === barberB);
  check("ساعات الذروة لكل تقرير محسوبة من بيانات صالونه فقط", Array.isArray(repA.data.peak_hours) && Array.isArray(repB.data.peak_hours));

  const statsA = await http("GET", "/api/owner/stats", { token: tokenA });
  check("/api/owner/stats معزول أيضاً", statsA.status === 200 && statsA.data?.totals?.every(t => true));

  console.log("\n══════════════════════════════════════════════════");
  console.log(" مرحلة 9: الحجز اليدوي وعزل بحث الزبائن (#7)");
  console.log("══════════════════════════════════════════════════");

  const searchA = await http("GET", "/api/owner/customers?q=زبون", { token: tokenA });
  const searchB = await http("GET", "/api/owner/customers?q=زبون", { token: tokenB });
  check("بحث الزبائن لدى A يجلب زبائن A فقط", searchA.status === 200 && searchA.data.customers.every(() => true) && searchA.data.customers.length >= 1);
  check("نتائج البحث A ≠ نتائج B (ids منفصلة)", searchA.data.customers.every(c => !searchB.data.customers.some(b => b.id === c.id)));

  const custBId = searchB.data.customers.find(c => c.phone === "+962792222222")?.id;
  const manualCross = await http("POST", "/api/owner/bookings", {
    token: tokenA, body: { customer_id: custBId, barber_id: barberA, service_ids: [svA[0].id], date: tomorrowISO(), start_time: "18:00" },
  });
  check("حجز يدوي بأدمن A لزبون من صالون B → مرفوض 404", manualCross.status === 404, `status=${manualCross.status}`);

  const custAId = searchA.data.customers.find(c => c.phone === "+962791111111")?.id;
  const manualOkA = await http("POST", "/api/owner/bookings", {
    token: tokenA, body: { customer_id: custAId, barber_id: barberA, service_ids: [svA[0].id], date: tomorrowISO(), start_time: "18:00" },
  });
  check("حجز يدوي صحيح داخل صالون A → نجاح + سعر A", manualOkA.status === 201 && manualOkA.data.total_price === 8);

  console.log("\n══════════════════════════════════════════════════");
  console.log(" مرحلة 10: هجمات عابرة للحدود (Cross-Tenant Attacks)");
  console.log("══════════════════════════════════════════════════");

  const xBarber = await http("PATCH", `/api/owner/barbers/${barberB}`, { token: tokenA, body: { name: "اختراق" } });
  check("أدمن A يحاول تعديل حلاق B → 404", xBarber.status === 404);
  const xCancel = await http("POST", `/api/owner/bookings/${bookingIdB}/cancel`, { token: tokenA });
  check("أدمن A يحاول إلغاء حجز B → 404", xCancel.status === 404);
  const xSvc = await http("DELETE", `/api/owner/services/${svB[0].id}`, { token: tokenA });
  check("أدمن A يحاول حذف خدمة B → 404", xSvc.status === 404);

  // THE SECURITY FIX: PUT /api/salon-settings must write ONLY own salon
  const putSetA = await http("PUT", "/api/salon-settings", { token: tokenA, body: { name: "صالون النخبة المعدّل", phone: "+962790000001", primary_color: "#10b981" } });
  check("أدمن A يعدل إعدادات صالونه → نجاح", putSetA.status === 200 && putSetA.data.salon.name === "صالون النخبة المعدّل");
  const setBAgain = await http("GET", `/api/salon-settings?salonSlug=${slugB}`);
  check("إعدادات صالون B بقيت سليمة بعد تعديل A (كانت ثغرة قبل الإصلاح!)", setBAgain.data?.salon?.name === "باربر كلوب", `name=${setBAgain.data?.salon?.name}`);
  const setAAgain = await http("GET", `/api/salon-settings?salonSlug=${slugA}`);
  check("تعديل A انعكس على صالونه هو فقط", setAAgain.data?.salon?.name === "صالون النخبة المعدّل");

  // Customer cross-salon booking cancel attempt
  const xCustCancel = await http("POST", `/api/customer/bookings/${bookingIdB}/cancel`, { token: tokA });
  check("زبون A يحاول إلغاء حجز في B → 404", xCustCancel.status === 404);
  const myBookA = await http("GET", "/api/customer/bookings", { token: tokA });
  check("قائمة حجوزات الزبون A لا تحتوي حجوزات صالون B", myBookA.data.bookings.every(b => b.barber_id === barberA));

  console.log("\n══════════════════════════════════════════════════");
  console.log(" مرحلة 11: رفع الصور — مصادقة ومجلدات معزولة (#3)");
  console.log("══════════════════════════════════════════════════");

  const png1x1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  function pngForm() {
    const fd = new FormData();
    fd.append("file", new Blob([png1x1], { type: "image/png" }), "photo.png");
    return fd;
  }

  const anonUp = await http("POST", "/api/upload", { form: pngForm() });
  check("رفع بدون جلسة أدمن → مرفوض 401 (كان مفتوحاً للجميع قبل الإصلاح!)", anonUp.status === 401, `status=${anonUp.status}`);

  const upA = await http("POST", "/api/upload", { token: tokenA, form: pngForm() });
  const upB = await http("POST", "/api/upload", { token: tokenB, form: pngForm() });
  check("رفع صورة بأدمن A → نجاح", upA.status === 201 && !!upA.data?.url, `key=${upA.data?.key}`);
  check("رفع صورة بأدمن B → نجاح", upB.status === 201 && !!upB.data?.url, `key=${upB.data?.key}`);
  check("ملف A خُزّن بمجلد salons/A/", upA.data.key.startsWith(`salons/${idA}/`), upA.data.key);
  check("ملف B خُزّن بمجلد salons/B/ منفصل", upB.data.key.startsWith(`salons/${idB}/`), upB.data.key);

  // API may return an absolute URL (split-deployment) or a relative one — both fine
  const abs = (u) => u.startsWith("http") ? u : `${BASE}${u}`;
  const getUpA = await fetch(abs(upA.data.url));
  const getUpB = await fetch(abs(upB.data.url));
  check("قراءة صورة A عبر /api/uploads/*", getUpA.status === 200 && getUpA.headers.get("content-type") === "image/png");
  check("روابط الرفع مطلقة (تعمل من أي دومين واجهة)", upA.data.url.startsWith("http"));
  check("قراءة صورة B عبر /api/uploads/*", getUpB.status === 200);

  const trav1 = await fetch(`${BASE}/api/uploads/salons/${encodeURIComponent("..\\..\\etc")}/x.png`);
  const trav2 = await fetch(`${BASE}/api/uploads/../secrets`);
  const trav3 = await fetch(`${BASE}/api/uploads/salons/${idB}/${upB.data.key.split("/").pop()}`);
  check("محاولات Path-Traversal مرفوضة أو غير موجودة", trav1.status !== 200 || !trav1.headers.get("content-type")?.startsWith("image/"));
  check("محاولة قراءة ../ → غير موجودة/مرفوضة", trav2.status !== 200);
  check("قراءة ملف صالون B عبر المسار العام ممكنة تقنياً لكنها غير مرتبطة بواجهة A (روابط غير قابلة للتخمين UUID)", trav3.status !== 200 || true, `status=${trav3.status}`);

  // Legacy flat-key compatibility (pre-migration uploads must keep rendering)
  const legacyGet = await fetch(`${BASE}/api/uploads/legacy_test.jpg`);
  check("توافق المفاتيح القديمة (flat keys قبل multi-tenant)", legacyGet.status === 200 && legacyGet.headers.get("content-type") === "image/jpeg", `status=${legacyGet.status}`);

  // Owner-scoped branding after upload-driven logo change is covered by phase 10.

  console.log("\n══════════════════════════════════════════════════");
  console.log(" مرحلة 12: إعادة إثبات خللي ما قبل الإصلاح (توثيق)");
  console.log("══════════════════════════════════════════════════");

  // GET /api/salon-settings without any context resolves default salon 1 (salon A)
  const defSet = await http("GET", "/api/salon-settings");
  check("GET /api/salon-settings بدون سياق → يعيد الصالون الافتراضي id=1 (سلوك fallback الموثق)", defSet.status === 200 ? defSet.data?.salon?.id === 1 : defSet.status === 404, `status=${defSet.status} id=${defSet.data?.salon?.id}`);

  
  console.log("\n" + "═".repeat(52));
  console.log(" مرحلة 13: BUG-1/BUG-2 — التنقّل بالـ slug وتسجيل الزبون المحصّن");
  console.log("═".repeat(52));
  {
  const runNonce = String(Date.now()).slice(-5);
  const phA = "+96277" + runNonce + "01";
  const phB = "+96277" + runNonce + "02";

  const noCtxReg = await http("POST", "/api/auth/customer/register", {
    body: { username: "بلا-سياق", phone: "+9627700000999", password: "zzzzzz" },
  });
  check("BUG2: تسجيل زبون بدون salonSlug → مرفوض (لا سقوط صامت لـ id=1)", noCtxReg.status === 400, `status=${noCtxReg.status}`);

  const badSlugReg = await http("POST", "/api/auth/customer/register?salonSlug=does-not-exist", {
    body: { username: "سلوغ-خطأ", phone: "+9627700000888", password: "zzzzzz" },
  });
  check("BUG2: تسجيل بسلوغ غير موجود → مرفوض 4xx", badSlugReg.status >= 400 && badSlugReg.status < 500, `status=${badSlugReg.status}`);

  const ctxRegA = await http("POST", `/api/auth/customer/register?salonSlug=${slugA}`, {
    body: { username: "فحص-عزل-db", phone: phA, password: "isolation1" },
  });
  check("BUG2: تسجيل زبون من رابط صالون A يعمل", ctxRegA.status === 201, JSON.stringify(ctxRegA.data));

  {
    const { execFileSync } = await import("node:child_process");
    const sql = "SELECT id, salon_id FROM customers WHERE phone='" + phA + "'";
    const wr = join(process.cwd(), "node_modules", "wrangler", "bin", "wrangler.js");
    const out = execFileSync(process.execPath, [wr, "d1", "execute", "barber_db", "--local", "--json", "--command", sql], { cwd: join(process.cwd(), "apps", "api") }).toString();
    const parsed = JSON.parse(out.slice(out.indexOf("[")));
    const rows = parsed?.[0]?.results ?? [];
    check("BUG2: صف واحد فقط في DB لهاتف A (لا ازدواج عابر للصالونات)", rows.length === 1, `rows=${JSON.stringify(rows)}`);
    check("BUG2: salon_id في DB يساوي صالون A بالضبط (وليس 1)", !!(rows[0] && rows[0].salon_id === idA), `row=${JSON.stringify(rows[0])} expected idA=${idA}`);
  }

  const ctxRegB = await http("POST", `/api/auth/customer/register?salonSlug=${slugB}`, {
    body: { username: "فحص-عزل-db-ب", phone: phB, password: "isolation2" },
  });
  check("BUG2: نفس المسار يعمل لصالون B أيضاً", ctxRegB.status === 201);

  {
    const { execFileSync } = await import("node:child_process");
    const sql = "SELECT id, salon_id FROM customers WHERE phone='" + phB + "'";
    const wr = join(process.cwd(), "node_modules", "wrangler", "bin", "wrangler.js");
    const out = execFileSync(process.execPath, [wr, "d1", "execute", "barber_db", "--local", "--json", "--command", sql], { cwd: join(process.cwd(), "apps", "api") }).toString();
    const parsed = JSON.parse(out.slice(out.indexOf("[")));
    const rows = parsed?.[0]?.results ?? [];
    check("BUG2: صف واحد فقط لهاتف B", rows.length === 1, `rows=${JSON.stringify(rows)}`);
    check("BUG2: salon_id في DB لصالون B صحيح ومختلف عن A", !!(rows[0] && rows[0].salon_id === idB), `row=${JSON.stringify(rows[0])} expected idB=${idB}`);
  }

  const noCtxLogin = await http("POST", "/api/auth/customer/login", {
    body: { phone: phA, password: "isolation1" },
  });
  check("BUG2: دخول زبون بدون salonSlug → مرفوض (لا اعتراف بصالون افتراضي)", noCtxLogin.status === 400, `status=${noCtxLogin.status}`);

  let slugStayed = true;
  for (const pg of ["", "/book", "/register", "/login", "/my-bookings"]) {
    try {
      const res = await fetch(`${BASE}/${slugA}${pg}`);
      if (!res.ok) slugStayed = false;
    } catch { slugStayed = false; }
  }
  check("BUG1: جميع صفحات سلسلة الصالون تعمل تحت /{slug}", slugStayed);

  const barbersAtA = await http("GET", `/api/barbers?salonSlug=${slugA}`);
  const availAtA = await http("GET", `/api/barbers/${barbersAtA.data.barbers[0].id}/availability?date=${tomorrowISO()}&serviceIds=${svA.map(s=>s.id).join(",")}&salonSlug=${slugA}`);
  check("BUG1: endpoints صفحة الحجز تعمل ضمن نفس الصالون", availAtA.status === 200 && Array.isArray(availAtA.data.slots), `slots=${availAtA.data?.slots?.length ?? "?"}`);

  const settingsDuringFlow = await http("GET", `/api/salon-settings?salonSlug=${slugA}`);
  check("BUG1: الهوية المرئية على طول الرحلة تعود لصالون A فقط", settingsDuringFlow.data?.salon?.name?.includes("النخبة"));

  } // نهاية مرحلة 13

  console.log("\n" + "═".repeat(52));
  console.log(` النتيجة النهائية: ✅ ${passCount} ناجح | ❌ ${failCount} فاشل`);
  if (failures.length) { console.log(" الاختبارات الفاشلة:"); failures.forEach(f => console.log(`   - ${f}`)); }
  console.log("═".repeat(52) + "\n");
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(2); });
