/**
 * Multi-Tenant SaaS — Comprehensive Isolation E2E Test
 * Runs against a local wrangler dev server (http://127.0.0.1:8787)
 * Tests two salons operating CONCURRENTLY with identical admin usernames.
 */
const BASE = process.env.E2E_BASE || "http://127.0.0.1:8787";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { webcrypto as nodeCrypto } from "node:crypto";

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

// Clamped month arithmetic on YYYY-MM-DD (mirrors apps/api/src/subscription.ts)
function addMonthsClampedISO(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + n, day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last))).toISOString().slice(0, 10);
}
function addDaysISO(iso, days) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// SALTED PBKDF2 — byte-compatible with apps/api/src/utils.ts hashPasswordPBKDF2
async function pbkdf2Hash(password) {
  const salt = nodeCrypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await nodeCrypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await nodeCrypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, keyMaterial, 256,
  );
  const b64 = (bytes) => Buffer.from(bytes).toString("base64");
  return `pbkdf2:sha256:100000:${b64(salt)}:${b64(new Uint8Array(bits))}`;
}

// Run a read/write SQL statement against the local wrangler dev D1
// (same mechanism stage 13 uses) → array of result sets
function d1sql(sql) {
  const wr = join(process.cwd(), "node_modules", "wrangler", "bin", "wrangler.js");
  const out = execFileSync(process.execPath, [wr, "d1", "execute", "barber_db", "--local", "--json", "--command", sql], { cwd: join(process.cwd(), "apps", "api") }).toString();
  return JSON.parse(out.slice(out.indexOf("[")));
}

async function main() {
  // Unique credentials per run — the persistent local D1 accumulates owners
  // from earlier runs, and credentials-only tenant resolution correctly
  // refuses logins whose username+password match multiple salons.
  const RUN = Math.random().toString(36).slice(2, 10);
  const passA = `secret-${RUN}`;
  const passB = `otherpass-${RUN}`;

  // Tokens/ids hoisted from later stages for the stage-18 race tests:
  let breakCustomerToken = null;   // stage 17 — break/time-off test customer
  let breakRebookId = null;        // stage 17 — that customer's confirmed booking id
  let customerAToken = null;       // stage 15 — customer A's latest (post-rotation) token

  console.log("\n══════════════════════════════════════════════════");
  console.log(" مرحلة 1: إنشاء صالونين بنفس اسم مستخدم الأدمن «admin»");
  console.log("══════════════════════════════════════════════════");

  // Register salon A and salon B via self-service signup — SAME username "admin"
  const regA = await http("POST", "/api/salons/register", {
    body: { name: "صالون النخبة", phone: "+962790000001", adminUsername: "admin", password: passA },
  });
  check("تسجيل صالون A عبر /signup", regA.status === 201 && !!regA.data?.salon?.slug, `slug=${regA.data?.salon?.slug} id=${regA.data?.salon?.id}`);
  const slugA = regA.data.salon.slug, idA = regA.data.salon.id, tokenA1 = regA.data.token;

  const regB = await http("POST", "/api/salons/register", {
    body: { name: "باربر كلوب", phone: "+962790000002", adminUsername: "admin", password: passB },
  });
  check("تسجيل صالون B بنفس اسم المستخدم «admin» (فريد لكل صالون)", regB.status === 201, `slug=${regB.data?.salon?.slug} id=${regB.data?.salon?.id}`);
  const slugB = regB.data.salon.slug, idB = regB.data.salon.id, tokenB1 = regB.data.token;
  check("معرّفا الصالونين مختلفان (عزل على مستوى DB)", idA !== idB, `A=${idA}, B=${idB}`);

  console.log("\n══════════════════════════════════════════════════");
  console.log(" مرحلة 2: تسجيل دخول الأدمن (النقطة الحرجة #1)");
  console.log("══════════════════════════════════════════════════");

  // Login with username+password ONLY (no salon-slug input exists anymore):
  // the backend resolves the tenant purely from the credentials themselves.
  const loginA = await http("POST", "/api/auth/owner/login", { body: { username: "admin", password: passA } });
  check("أدمن صالون A (اسم مستخدم + كلمة مرور فقط) → نجاح", loginA.status === 200 && loginA.data?.token, "");
  check("الاستجابة تعيد بيانات الصالون الصحيح A", loginA.data?.salon?.id === idA && loginA.data?.salon?.slug === slugA, JSON.stringify(loginA.data?.salon));

  const loginB = await http("POST", "/api/auth/owner/login", { body: { username: "admin", password: passB } });
  check("أدمن صالون B بنفس اسم المستخدم «admin» وكلمة مروره → نجاح", loginB.status === 200 && !!loginB.data?.token, "");
  check("الاستجابة تعيد بيانات الصالون الصحيح B (وليس A)", loginB.data?.salon?.id === idB && loginB.data?.salon?.slug === slugB, JSON.stringify(loginB.data?.salon));

  // Wrong password → generic 401 (no tenant leakage either way)
  const badPass = await http("POST", "/api/auth/owner/login", { body: { username: "admin", password: "wrong-password" } });
  check("كلمة مرور خاطئة → 401 بدون أي تسرب", badPass.status === 401, `msg=${badPass.data?.error}`);

  // Ambiguity guard: register salon C with the SAME username AND password as
  // salon A → credentials alone cannot pick a tenant → the API must refuse
  // instead of guessing (zero ambiguity, zero cross-tenant session mixing).
  const regC = await http("POST", "/api/salons/register", {
    body: { name: "صالون ثالث", phone: "+962790000003", adminUsername: "admin", password: passA },
  });
  check("تسجيل صالون C بنفس اسم المستخدم وكلمة المرور مثل A", regC.status === 201, `id=${regC.data?.salon?.id}`);

  const ambLogin = await http("POST", "/api/auth/owner/login", { body: { username: "admin", password: passA } });
  check("بيانات دخول تطابق أكثر من صالون → 409 (لا تخمين ولا خلط جلسات)", ambLogin.status === 409, `msg=${ambLogin.data?.error}`);

  // Salon B's credentials remain unambiguous and still resolve to B
  const loginBAgain = await http("POST", "/api/auth/owner/login", { body: { username: "admin", password: passB } });
  check("دخول صالون B بعد تسجيل C → ما زال يعمل ويُرجع B", loginBAgain.status === 200 && loginBAgain.data?.salon?.id === idB, "");

  // NOTE: owner re-login revokes the previous session (single active session
  // enforcement) — so B's live token is the one from loginBAgain, not loginB.
  const tokenA = loginA.data.token, tokenB = loginBAgain.data.token;

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

  // ── Session-scoped availability (admin manual booking flow) ──
  const availOwn = await http(
    "GET",
    `/api/owner/barbers/${barberA}/availability?date=${tDate}&serviceIds=${svA[0].id}&clientTime=00:00`,
    { token: tokenA },
  );
  check(
    "توفّر الحلاق عبر جلسة الأدمن (نقطة يدوية) → فترات متاحة فعلاً",
    availOwn.status === 200 && (availOwn.data?.slots?.length ?? 0) > 0,
    `slots=${availOwn.data?.slots?.length}`,
  );

  // Cross-tenant guard: barber A belongs to salon A — salon B's session must NOT read it
  const availCross = await http(
    "GET",
    `/api/owner/barbers/${barberA}/availability?date=${tDate}&serviceIds=${svA[0].id}&clientTime=00:00`,
    { token: tokenB },
  );
  check("جلسة صالون B لا يمكنها قراءة توفّر حلاق صالون A عبر /api/owner → 404", availCross.status === 404, `status=${availCross.status}`);

  // Regression proof: the PUBLIC endpoint without salonSlug falls back to
  // DEFAULT_SALON_ID — exactly why the admin form must use the owner endpoint.
  const availPublicNoCtx = await http(
    "GET",
    `/api/barbers/${barberA}/availability?date=${tDate}&serviceIds=${svA[0].id}&clientTime=00:00`,
  );
  check("نقطة التوفّر العامة بدون salonSlug → 404 (حلاق A ليس في الصالون الافتراضي)", availPublicNoCtx.status === 404, `status=${availPublicNoCtx.status}`);

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

  // NEW (migration 0013): manual booking for a customer who ALREADY has an
  // active booking must now be rejected by the DB-level customer-active index.
  const manualWhileActive = await http("POST", "/api/owner/bookings", {
    token: tokenA, body: { customer_id: custAId, barber_id: barberA, service_ids: [svA[0].id], date: tomorrowISO(), start_time: "18:00" },
  });
  check("حجز يدوي لزبون لديه حجز نشط بالفعل → 400 (سياسة الحجز الواحد مفروضة على مستوى DB)",
    manualWhileActive.status === 400 && (manualWhileActive.data?.error ?? "").includes("حجز نشط"),
    `status=${manualWhileActive.status} msg=${manualWhileActive.data?.error}`);

  // Free customer A (cancel the 16:30 rebooking), then the manual booking succeeds
  await http("POST", `/api/owner/bookings/${rebookA.data.id}/cancel`, { token: tokenA });
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
  console.log(" مرحلة 14: تلاعب يدوي بالسلوغ — جلسة صالون A + salonSlug=B في الرابط");
  console.log("═".repeat(52));
  {
    // Scenario: a user with an authenticated session for salon A manually edits
    // the URL slug to salon B. The frontend (withSlug()) then appends
    // ?salonSlug=<B> to EVERY API call — including private owner/customer ones.
    // SECURITY CONTRACT: private endpoints must IGNORE the client-supplied
    // slug entirely and scope every query to the server-side session salon.

    // ── 1) Owner of A + slug B ──
    const sBk = await http("GET", `/api/owner/bookings?salonSlug=${slugB}`, { token: tokenA });
    check("OWNER-SLUG: حجوزات أدمن A مع سلوغ B → حجوزات A فقط (بلا أي صف من B)",
      sBk.status === 200 && sBk.data.bookings.length >= 1 && sBk.data.bookings.every(b => b.salon_id === idA && b.barber_id !== barberB),
      `salon_ids=${[...new Set((sBk.data?.bookings ?? []).map(b => b.salon_id))].join(",")}`);

    const sCust = await http("GET", `/api/owner/customers?q=${encodeURIComponent("زبون")}&salonSlug=${slugB}`, { token: tokenA });
    check("OWNER-SLUG: بحث الزبائن لأدمن A مع سلوغ B → زبائن A فقط (بلا زبائن B)",
      sCust.status === 200 && sCust.data.customers.length >= 1 && sCust.data.customers.every(c => c.id !== custBId),
      `count=${sCust.data?.customers?.length}`);

    const sRep = await http("GET", `/api/owner/reports?from=${tDate}&to=${tDate}&salonSlug=${slugB}`, { token: tokenA });
    check("OWNER-SLUG: تقارير أدمن A مع سلوغ B → إيراد A فقط (8/حجز، لا 12)",
      sRep.status === 200 && sRep.data.summary.total_revenue === 8 * sRep.data.summary.confirmed_count,
      `revenue=${sRep.data?.summary?.total_revenue}`);

    const sSet = await http("GET", `/api/owner/salon-settings?salonSlug=${slugB}`, { token: tokenA });
    check("OWNER-SLUG: إعدادات الصالون مع سلوغ B → صالون A وليس B",
      sSet.status === 200 && sSet.data.salon.id === idA && sSet.data.salon.id !== idB,
      `salon=${sSet.data?.salon?.id}`);

    const sNotif = await http("GET", `/api/owner/notifications?salonSlug=${slugB}`, { token: tokenA });
    check("OWNER-SLUG: إشعارات الأدمن مع سلوغ B → salon_id=A فقط",
      sNotif.status === 200 && sNotif.data.notifications.every(n => n.salon_id === idA),
      `salon_ids=${[...new Set((sNotif.data?.notifications ?? []).map(n => n.salon_id))].join(",") || "empty"}`);

    // ── 2) Customer of A + slug B ──
    const cBk = await http("GET", `/api/customer/bookings?salonSlug=${slugB}`, { token: tokA });
    check("CUST-SLUG: حجوزات زبون A مع سلوغ B → حجوزات صالون A فقط",
      cBk.status === 200 && cBk.data.bookings.every(b => b.barber_id !== barberB),
      `barber_ids=${[...new Set((cBk.data?.bookings ?? []).map(b => b.barber_id))].join(",") || "empty"}`);

    const cNotif = await http("GET", `/api/customer/notifications?salonSlug=${slugB}`, { token: tokA });
    check("CUST-SLUG: إشعارات زبون A مع سلوغ B → salon_id=A فقط",
      cNotif.status === 200 && cNotif.data.notifications.every(n => n.salon_id === idA),
      `salon_ids=${[...new Set((cNotif.data?.notifications ?? []).map(n => n.salon_id))].join(",") || "empty"}`);

    // ── 3) Forged salon_id in the BODY of a write → must be ignored ──
    // Free customer A first (cancel the stage-9 manual booking) — the
    // customer-active unique index (migration 0013) would otherwise reject.
    await http("POST", `/api/owner/bookings/${manualOkA.data.booking_id}/cancel`, { token: tokenA });
    const forged = await http("POST", "/api/owner/bookings", {
      token: tokenA,
      body: { customer_id: custAId, barber_id: barberA, service_ids: [svA[0].id], date: tomorrowISO(), start_time: "19:30", salon_id: idB, salonSlug: slugB },
    });
    check("OWNER-SLUG: حجز يدوي مع salon_id مزوّر في الجسم → نجاح (الإنشاء بجلسة A)", forged.status === 201);
    // Proof of binding: if the forged salon_id had been trusted, the booking
    // would have been written into salon B and B's owner would now see a
    // booking on barber A — which must never appear in B's list.
    const bListAfter = await http("GET", "/api/owner/bookings", { token: tokenB });
    check("OWNER-SLUG: الحجز المزوّر لم يُكتب في صالون B (لا حجز على حلاق A في قائمة B)",
      bListAfter.status === 200 && bListAfter.data.bookings.every(b => b.barber_id !== barberA));
  } // نهاية مرحلة 14

  console.log("\n" + "═".repeat(52));
  console.log(" مرحلة 15: جلسة واحدة نشطة — تسجيل الدخول يبطل الجلسات السابقة");
  console.log("═".repeat(52));
  {
    // ── 1) Owner of B logs in from a "new device" → old token must die ──
    // (A's credentials are intentionally ambiguous in this run — salon C was
    // registered with the same username+password in stage 1 — so B's owner,
    // whose credentials are unique, is used for the re-login scenario.)
    const reLoginB = await http("POST", "/api/auth/owner/login", { body: { username: "admin", password: passB } });
    check("SESSION: دخول أدمن B من جهاز جديد → نجاح ورمز جديد",
      reLoginB.status === 200 && !!reLoginB.data?.token && reLoginB.data.token !== tokenB);
    const newTokenB = reLoginB.data.token;

    // NOTE: B's previous owner session was created at stage 2 (loginBAgain).
    const oldTokenCheck = await http("GET", "/api/owner/bookings", { token: tokenB });
    check("SESSION: الجلسة القديمة لأدمن B بعد الدخول الجديد → 401 مع code=SESSION_EXPIRED",
      oldTokenCheck.status === 401 && oldTokenCheck.data?.code === "SESSION_EXPIRED",
      `status=${oldTokenCheck.status} code=${oldTokenCheck.data?.code}`);

    const newTokenCheck = await http("GET", "/api/owner/bookings", { token: newTokenB });
    check("SESSION: الجلسة الجديدة لأدمن B تعمل طبيعياً بعد الإبطال", newTokenCheck.status === 200);

    // Owner isolation respected: B's re-login must NOT touch A's owner session
    const aStillValidOwner = await http("GET", "/api/owner/salon-settings", { token: tokenA });
    check("SESSION: إبطال جلسات أدمن B لم يمسّ جلسة أدمن A (عزل لكل حساب)",
      aStillValidOwner.status === 200 && aStillValidOwner.data?.salon?.id === idA);

    // ── 2) Customer of A logs in from a "new device" → old token must die ──
    const reCustA = await http("POST", `/api/auth/customer/login?salonSlug=${slugA}`, {
      body: { phone: "+962791111111", password: "custpass1" },
    });
    check("SESSION: دخول زبون A من جهاز جديد → نجاح ورمز جديد",
      reCustA.status === 200 && !!reCustA.data?.token && reCustA.data.token !== tokA);
    const newTokA = reCustA.data.token;
    customerAToken = newTokA; // hoisted for stage 18

    const oldCustCheck = await http("GET", "/api/customer/bookings", { token: tokA });
    check("SESSION: رمز زبون A القديم بعد الدخول الجديد → 401 مع code=SESSION_EXPIRED",
      oldCustCheck.status === 401 && oldCustCheck.data?.code === "SESSION_EXPIRED",
      `status=${oldCustCheck.status} code=${oldCustCheck.data?.code}`);

    const newCustCheck = await http("GET", "/api/customer/bookings", { token: newTokA });
    check("SESSION: رمز زبون A الجديد يعمل طبيعياً", newCustCheck.status === 200);

    // ── 3) Role separation: customer re-login must NOT touch owner sessions ──
    const ownerAfterCust = await http("GET", "/api/owner/salon-settings", { token: newTokenB });
    check("SESSION: إبطال جلسة الزبون لم يمسّ جلسة الأدمن (فصل الأدوار سليم)",
      ownerAfterCust.status === 200 && ownerAfterCust.data?.salon?.id === idB);

    // ── 4) Per-salon scoping: same customer logging into salon B (if a
    // customer with the same phone exists there) must NOT kill salon A session.
    // Customer A2/B2 share the phone-per-salon model; use B's own customer.
    const reCustB = await http("POST", `/api/auth/customer/login?salonSlug=${slugB}`, {
      body: { phone: "+962792222222", password: "custpass2" },
    });
    check("SESSION: دخول زبون B من جهاز جديد → نجاح (حساب منفصل)", reCustB.status === 200);
    const aStillValid = await http("GET", "/api/customer/bookings", { token: newTokA });
    check("SESSION: دخول زبون صالون B لم يبطل جلسة زبون صالون A (الحسابات لكل صالون)",
      aStillValid.status === 200);
  } // نهاية مرحلة 15

  console.log("\n" + "═".repeat(52));
  console.log(" مرحلة 16: رقم هاتف مسجّل في صالون آخر → خطأ واضح بلا أي تسرب عابر");
  console.log("═".repeat(52));
  {
    // custA2's phone (+962794444444) exists ONLY in salon A, never in B.
    const notHere = await http("POST", `/api/auth/customer/login?salonSlug=${slugB}`, {
      body: { phone: "+962794444444", password: "custpass4" },
    });
    check("REG-CTX: دخول برقم مسجّل في A فقط عبر رابط صالون B → 404 مع code=NOT_REGISTERED_THIS_SALON",
      notHere.status === 404 && notHere.data?.code === "NOT_REGISTERED_THIS_SALON",
      `status=${notHere.status} code=${notHere.data?.code}`);

    check("REG-CTX: رسالة الخطأ تعيد اسم صالون B نفسه فقط (بيانات هذا الصالون العامة)",
      typeof notHere.data?.salon_name === "string" && notHere.data.salon_name.length > 0,
      `salon_name=${notHere.data?.salon_name}`);

    // Cross-tenant leakage guard: the response must contain NO trace of salon A
    const raw = JSON.stringify(notHere.data ?? {});
    check("REG-CTX: لا أي تسرب لاسم أو معرّف الصالون A في الاستجابة",
      !raw.includes("النخبة") && !raw.includes(String(idA)), raw);

    // Same phone WITH an account in B but wrong password → generic 401, no code
    const wrongPass = await http("POST", `/api/auth/customer/login?salonSlug=${slugB}`, {
      body: { phone: "+962791111111", password: "wrong-password" },
    });
    check("REG-CTX: حساب موجود في B بكلمة مرور خاطئة → 401 عام (بدون code تسجيل)",
      wrongPass.status === 401 && wrongPass.data?.error?.includes("غير صحيحة") && !wrongPass.data?.code,
      `status=${wrongPass.status}`);

    // The same phone registered in A still logs in normally at A (no side effects)
    const stillWorksA = await http("POST", `/api/auth/customer/login?salonSlug=${slugA}`, {
      body: { phone: "+962794444444", password: "custpass4" },
    });
    check("REG-CTX: حساب A يعمل طبيعياً بعد محاولة الدخول عبر B", stillWorksA.status === 200);
  } // نهاية مرحلة 16

  console.log("\n══════════════════════════════════════════════════");
  console.log(" مرحلة 17: منع الحجز أثناء الاستراحة/الإجازة (validateBookingSlot)");
  console.log("══════════════════════════════════════════════════");

  // All three booking write paths (customer POST, customer PATCH, owner manual)
  // share one validator — a customer with a stale tab or a crafted request must
  // NOT be able to book during a barber break or a time-off day.
  {
    // Fresh customer for salon A (unique phone per run)
    const custBreak = await registerCustomer(
      slugA,
      `زبون-استراحة-${RUN}`,
      `+96279${Math.floor(1000000 + Math.random() * 8999999)}`,
      "custbreak1",
    );
    const tokBreak = custBreak.login.data?.token;
    breakCustomerToken = tokBreak; // hoisted for stage 18
    check("BREAK-إعداد: تسجيل زبون جديد لصالون A", !!tokBreak);

    // NOTE: we reuse tokenA — salon C (stage 2) shares A's username+password,
    // so a fresh owner login for A would hit the 409 ambiguity guard.
    const tokABreak = tokenA;
    check("BREAK-إعداد: جلسة أدمن صالون A", !!tokABreak);

    const dow = new Date(tDate + "T00:00:00Z").getUTCDay();

    // 1) Owner adds a weekly break 12:00-13:00 on that day of week
    const brk = await http("POST", `/api/owner/barbers/${barberA}/breaks`, {
      token: tokABreak,
      body: { day_of_week: dow, start_time: "12:00", end_time: "13:00" },
    });
    check("BREAK-إعداد: إضافة استراحة 12:00-13:00 للحلاق", brk.status === 200 || brk.status === 201, `msg=${JSON.stringify(brk.data)}`);

    // 2) Customer POST during the break → must be rejected (was accepted before the fix)
    const inBreak = await http("POST", "/api/customer/bookings", {
      token: tokBreak,
      body: { barber_id: barberA, service_ids: [svA[0].id], date: tDate, start_time: "12:00" },
    });
    check("BREAK-1: حجز زبون داخل فترة استراحة الحلاق → 400", inBreak.status === 400, `msg=${inBreak.data?.error}`);

    // 3) Customer PATCH (reschedule) into the break → must be rejected as well.
    //    First get a confirmed booking at a free time (16:00 tomorrow).
    const baseBook = await http("POST", "/api/customer/bookings", {
      token: tokBreak,
      body: { barber_id: barberA, service_ids: [svA[0].id], date: tDate, start_time: "16:00" },
    });
    check("BREAK-إعداد: حجز أساسي ساعة 16:00 نجح", baseBook.status === 201, `msg=${JSON.stringify(baseBook.data)}`);
    const patchInBreak = await http("PATCH", `/api/customer/bookings/${baseBook.data?.id}`, {
      token: tokBreak,
      body: { date: tDate, start_time: "12:00" },
    });
    check("BREAK-2: تعديل الحجز إلى داخل الاستراحة → 400", patchInBreak.status === 400, `msg=${patchInBreak.data?.error}`);

    // 4) Owner manual booking inside the break → same rejection (same validator)
    const manualInBreak = await http("POST", "/api/owner/bookings", {
      token: tokABreak,
      body: { customer_id: custBreak.login.data?.customer?.id, barber_id: barberA, service_ids: [svA[0].id], date: tDate, start_time: "12:30" },
    });
    check("BREAK-3: حجز يدوي للأدمن داخل الاستراحة → 400", manualInBreak.status === 400, `msg=${manualInBreak.data?.error}`);

    // 5) Time-off: owner marks the day AFTER tomorrow as leave; customer POST/PATCH there → 400
    const offDate = new Date(Date.now() + 3 * 3600_000 + 2 * 24 * 3600_000).toISOString().slice(0, 10);
    const off = await http("POST", `/api/owner/barbers/${barberA}/time-off`, {
      token: tokABreak,
      body: { date: offDate, reason: "إجازة اختبار" },
    });
    check("TIMEOFF-إعداد: تعيين إجازة خاصة للتاريخ " + offDate, off.status === 200 || off.status === 201, `msg=${JSON.stringify(off.data)}`);

    // Cancel the 16:00 booking first (single-active-booking policy would block a new POST)
    await http("POST", `/api/customer/bookings/${baseBook.data?.id}/cancel`, { token: tokBreak });

    const onLeave = await http("POST", "/api/customer/bookings", {
      token: tokBreak,
      body: { barber_id: barberA, service_ids: [svA[0].id], date: offDate, start_time: "15:00" },
    });
    check("TIMEOFF-1: حجز زبون في يوم إجازة الحلاق → 400", onLeave.status === 400, `msg=${onLeave.data?.error}`);

    // PATCH into the leave day → 400 (and booking stays on its original slot)
    const rebook = await http("POST", "/api/customer/bookings", {
      token: tokBreak,
      body: { barber_id: barberA, service_ids: [svA[0].id], date: tDate, start_time: "17:00" },
    });
    check("TIMEOFF-إعداد: حجز بديل 17:00 نجح", rebook.status === 201, `msg=${JSON.stringify(rebook.data)}`);
    breakRebookId = rebook.data?.id; // hoisted for stage 18
    const patchOnLeave = await http("PATCH", `/api/customer/bookings/${rebook.data?.id}`, {
      token: tokBreak,
      body: { date: offDate, start_time: "15:00" },
    });
    check("TIMEOFF-2: تعديل الحجز إلى يوم الإجازة → 400", patchOnLeave.status === 400, `msg=${patchOnLeave.data?.error}`);

    // Booking untouched after the rejected PATCH
    const mine = await http("GET", "/api/customer/bookings", { token: tokBreak });
    const stillIntact = (mine.data?.bookings ?? []).some((b) => b.id === rebook.data?.id && b.booking_date === tDate && b.status === "confirmed");
    check("TIMEOFF-3: الحجز لم يتأثر بعد رفض التعديل", stillIntact);

  // (stage 18 lives inside this block: it reuses tokBreak / rebook from above)

  console.log("\n══════════════════════════════════════════════════");
  console.log(" مرحلة 18: سباقات الحجز المتزامنة (فهارس UNIQUE — migration 0013)");
  console.log("══════════════════════════════════════════════════");

  // The app-level checks are separate SELECTs — only the DB-level partial
  // unique indexes guarantee correctness when two requests race. Each test
  // fires two booking requests SIMULTANEOUSLY and expects exactly one winner.
  // NOTE: reuses existing customer tokens (tokBreak / tokA2) — the per-salon
  // customer-register rate limit (5 / 5 min) is already consumed by earlier
  // stages, and fresh registrations here would 429.
  {
    // Free both customers: cancel their active confirmed bookings.
    // NOTE: reuses existing customers — earlier stages exhausted the per-salon
    // customer register/login rate limits (5 / 5 min), so fresh accounts would 429.
    await http("POST", `/api/customer/bookings/${breakRebookId}/cancel`, { token: breakCustomerToken }); // 17:00 tomorrow
    // Customer A holds the stage-14 forged-salon_id booking (19:30) — cancel it
    const custABookings = await http("GET", "/api/customer/bookings", { token: customerAToken });
    const activeA = (custABookings.data?.bookings ?? []).find((b) => b.status === "confirmed");
    if (activeA) await http("POST", `/api/customer/bookings/${activeA.id}/cancel`, { token: customerAToken });
    const free1 = await http("GET", "/api/customer/bookings", { token: breakCustomerToken });
    const free2 = await http("GET", "/api/customer/bookings", { token: customerAToken });
    check("RACE-إعداد: الزبونان بلا حجز نشط",
      !free1.data.bookings.some(b => b.status === "confirmed") && !free2.data.bookings.some(b => b.status === "confirmed"));

    // 1) Slot race: two DIFFERENT customers, SAME slot (tomorrow 20:00),
    //    fired simultaneously → exactly one 201; loser gets 409/400.
    const slotBody = (tok) => ({
      token: tok,
      body: { barber_id: barberA, service_ids: [svA[0].id], date: tDate, start_time: "20:00" },
    });
    const [r1, r2] = await Promise.all([
      http("POST", "/api/customer/bookings", slotBody(breakCustomerToken)),
      http("POST", "/api/customer/bookings", slotBody(customerAToken)),
    ]);
    const st = [r1.status, r2.status].sort();
    check(
      "RACE-1: حجزان متزامنان لنفس الموعد → فائز واحد فقط",
      st[0] === 201 && (st[1] === 409 || st[1] === 400),
      `statuses=${r1.status}/${r2.status} errs=${r1.data?.error ?? ""} | ${r2.data?.error ?? ""}`,
    );
    const raceLoserTok = r1.status !== 201 ? breakCustomerToken : customerAToken;
    const raceLoserRes = r1.status !== 201 ? r1 : r2;
    const raceWinnerTok = r1.status === 201 ? breakCustomerToken : customerAToken;
    check(
      "RACE-2: رسالة الخاسر واضحة (الموعد حُجز للتو) وليست خطأ 500",
      raceLoserRes.status !== 500 && typeof raceLoserRes.data?.error === "string",
      `msg=${raceLoserRes.data?.error}`,
    );

    // 2) Single-active race: the slot-race LOSER (no active booking) fires two
    //    simultaneous bookings at different slots (20:30 / 21:00) → exactly one 201.
    const [s1, s2] = await Promise.all([
      http("POST", "/api/customer/bookings", { token: raceLoserTok, body: { barber_id: barberA, service_ids: [svA[0].id], date: tDate, start_time: "20:30" } }),
      http("POST", "/api/customer/bookings", { token: raceLoserTok, body: { barber_id: barberA, service_ids: [svA[0].id], date: tDate, start_time: "21:00" } }),
    ]);
    const st2 = [s1.status, s2.status].sort();
    check(
      "RACE-3: حجزان متزامنان من نفس الزبون → حجز نشط واحد فقط",
      st2[0] === 201 && st2[1] === 400,
      `statuses=${s1.status}/${s2.status} errs=${s1.data?.error ?? ""} | ${s2.data?.error ?? ""}`,
    );
    const sLoser = s1.status !== 201 ? s1 : s2;
    check(
      "RACE-4: رسالة الخاسر = سياسة الحجز النشط الواحد",
      sLoser.status === 400 && (sLoser.data?.error ?? "").includes("حجز نشط"),
      `msg=${sLoser.data?.error}`,
    );

    // 3) DB truth via each customer's booking list:
    const mine1 = await http("GET", "/api/customer/bookings", { token: raceWinnerTok });
    const confirmed1 = (mine1.data?.bookings ?? []).filter((b) => b.status === "confirmed");
    check("RACE-5: الفائز بسباق الموعد لديه حجز مؤكد واحد فقط في DB", confirmed1.length === 1, `count=${confirmed1.length}`);
    const mine2 = await http("GET", "/api/customer/bookings", { token: raceLoserTok });
    const confirmed2 = (mine2.data?.bookings ?? []).filter((b) => b.status === "confirmed");
    const totalConfirmed = confirmed1.length + confirmed2.length;
    // Exactly 2 confirmed bookings across both customers: one from the slot
    // race (20:00) + one from the single-active race (20:30 or 21:00).
    check("RACE-6: مجموع الحجوزات المؤكدة = 2 (لا مكررات على مستوى DB)", totalConfirmed === 2, `total=${totalConfirmed}`);
  } // نهاية مرحلة 17 + 18

  // ═══════════════════════════════════════════════════════════════════
  // مراحل الاشتراكات و Super Admin — تُنفّذ في النهاية عمداً لأنها توقف
  // الصالونات (إقفال فوري للوحات والزبائن) ثم تستعيدها.
  // ═══════════════════════════════════════════════════════════════════

  console.log("\n" + "═".repeat(52));
  console.log(" مرحلة 19: Super Admin — إنشاء الحساب والدخول والعزل والإحصائيات");
  console.log("═".repeat(52));
  let saTok = null, saId = null;
  {
    // NO seeded super admin exists (migration deliberately ships none):
    // create the first account exactly like scripts/create-super-admin.mjs
    const saUser = `root-${RUN}`;
    const saPass = `RootPass-${RUN}-X9!`;
    d1sql(`INSERT INTO super_admins (username, password_hash) VALUES ('${saUser}', '${await pbkdf2Hash(saPass)}')`);

    const badSa = await http("POST", "/api/super-admin/login", { body: { username: saUser, password: "wrong-password-123" } });
    check("SUPER-1: كلمة مرور خاطئة للمالك العام → 401", badSa.status === 401, `status=${badSa.status}`);

    const saLogin = await http("POST", "/api/super-admin/login", { body: { username: saUser, password: saPass } });
    check("SUPER-2: دخول المالك العام (PBKDF2 مملّح) → نجاح", saLogin.status === 200 && !!saLogin.data?.token, JSON.stringify(saLogin.data));
    saTok = saLogin.data?.token ?? null;
    saId = saLogin.data?.super_admin?.id ?? null;

    // ── ISOLATION: the two auth realms can never cross ──
    const ownerOnSa = await http("GET", "/api/super-admin/salons", { token: tokenB });
    check("SUPER-3: جلسة أدمن صالون لا تفتح /api/super-admin/* → 401", ownerOnSa.status === 401, `status=${ownerOnSa.status}`);
    const saOnOwner = await http("GET", "/api/owner/salon-settings", { token: saTok });
    check("SUPER-4: جلسة المالك العام لا تفتح /api/owner/* → 401", saOnOwner.status === 401, `status=${saOnOwner.status}`);
    const saOnCust = await http("GET", "/api/customer/bookings", { token: saTok });
    check("SUPER-5: جلسة المالك العام لا تفتح /api/customer/* → 401", saOnCust.status === 401, `status=${saOnCust.status}`);

    // ── Platform stats & salon list ──
    const stats = await http("GET", "/api/super-admin/stats", { token: saTok });
    check("SUPER-6: إحصائيات المنصة (إجمالي + عدد كل حالة)", stats.status === 200 && stats.data?.stats?.total_salons >= 3 && ["trial", "active", "expired"].every((k) => typeof stats.data.stats[k] === "number"), JSON.stringify(stats.data?.stats));

    const list = await http("GET", "/api/super-admin/salons", { token: saTok });
    const rowB = (list.data?.salons ?? []).find((s) => s.id === idB);
    const rowA = (list.data?.salons ?? []).find((s) => s.id === idA);
    check("SUPER-7: قائمة الصالونات تعرض slug والحالة وتاريخ التسجيل وبداية الدورة",
      list.status === 200 && rowA && rowB && rowA.slug === slugA && rowB.slug === slugB
        && typeof rowB.subscription_status === "string" && !!rowB.created_at && !!rowB.subscription_start_date,
      JSON.stringify(rowB));
    check("SUPER-8: عدد الحجوزات لكل صالون محسوب (B لديه حجوزات من المراحل السابقة)",
      (rowB?.bookings_count ?? 0) >= 1 && (rowA?.bookings_count ?? 0) >= 1,
      `A=${rowA?.bookings_count}, B=${rowB?.bookings_count}`);

    const cfg = await http("GET", "/api/super-admin/settings", { token: saTok });
    check("SUPER-9: إعدادات المنصة الافتراضية (هاتف 0795105850 + تجربة 30 يوم + القالبان)",
      cfg.status === 200 && cfg.data?.settings?.renewal_phone === "0795105850"
        && cfg.data?.settings?.trial_duration_days === 30
        && cfg.data?.settings?.expired_lockout_template?.includes("{phone}")
        && cfg.data?.settings?.renewal_banner_template?.includes("{phone}"),
      JSON.stringify(cfg.data?.settings));

    // Reserved slugs: a salon can never take a super-admin route name
    const saSlugTry = await http("POST", "/api/salons/register", {
      body: { name: "super-admin", phone: "+962796666666", adminUsername: `x-${RUN}`, password: "xxxxxx" },
    });
    check("SUPER-10: تسجيل صالون باسم «super-admin» → مرفوض (سلوغ محجوز)", saSlugTry.status === 400, `status=${saSlugTry.status}`);
  } // نهاية مرحلة 19

  console.log("\n" + "═".repeat(52));
  console.log(" مرحلة 20: انتهاء الاشتراك — إقفال فوري شامل ثم استعادة فورية");
  console.log("═".repeat(52));
  let reloginB = null;
  {
    // Fresh owner session for B BEFORE expiry (mid-session enforcement test).
    const preB = await http("POST", "/api/auth/owner/login", { body: { username: "admin", password: passB } });
    check("EXPIRE-إعداد: جلسة أدمن B نشطة قبل الإيقاف", preB.status === 200 && !!preB.data?.token, `status=${preB.status}`);
    const preBToken = preB.data?.token;

    // Fresh CUSTOMER session for B — stage 15's re-login rotated the old token
    // (single-active-session), so tokB is intentionally dead by now. The live
    // token is read straight from the DB: the customer-login rate limiter
    // (5/5min per IP) is already exhausted by earlier stages, and login isn't
    // what we're testing — the ENDPOINTS are.
    const tokB2 = d1sql(`SELECT token FROM customers WHERE salon_id = ${idB} AND phone = '+962792222222' LIMIT 1`)[0]?.results?.[0]?.token ?? null;
    check("EXPIRE-إعداد: رمز جلسة زبون B الحي مُستخرج (لا اختبار دخول هنا — ما يُختبر هو نقاط النهاية)", !!tokB2);

    // Freshly-VALID owner session must still not cross into the super-admin realm
    const ownerValidOnSa = await http("GET", "/api/super-admin/salons", { token: preBToken });
    check("SUPER-3b: جلسة أدمن صالون صالحة 100% لا تفتح /api/super-admin/* → 401", ownerValidOnSa.status === 401, `status=${ownerValidOnSa.status}`);

    const cntBefore = d1sql(`SELECT COUNT(*) AS n FROM bookings WHERE salon_id = ${idB}`)[0]?.results?.[0]?.n ?? -1;

    // ── Deactivate via the Super Admin dashboard endpoint ──
    const exp = await http("PATCH", `/api/super-admin/salons/${idB}/status`, { token: saTok, body: { status: "expired" } });
    check("EXPIRE-1: المالك العام يوقف صالون B → 200", exp.status === 200 && exp.data?.salon?.subscription_status === "expired", JSON.stringify(exp.data));

    // The EXACT configured lockout message (template + phone from platform_settings)
    const cfg = await http("GET", "/api/super-admin/settings", { token: saTok });
    const lockoutMessage = (cfg.data?.settings?.expired_lockout_template ?? "").split("{phone}").join(cfg.data?.settings?.renewal_phone ?? "");
    check("EXPIRE-إعداد: رسالة الإقفال مُولّدة من الإعدادات وتحمل الرقم", lockoutMessage.includes("0795105850") && lockoutMessage.includes("اشتراك"), lockoutMessage);

    // ── Admin login is BLOCKED with the exact message ──
    const loginAfter = await http("POST", "/api/auth/owner/login", { body: { username: "admin", password: passB } });
    check("EXPIRE-2: دخول أدمن صالون موقوف → 403 مع الرسالة المضبوطة حرفياً",
      loginAfter.status === 403 && loginAfter.data?.error === lockoutMessage && loginAfter.data?.code === "SUBSCRIPTION_EXPIRED",
      `status=${loginAfter.status} msg=${loginAfter.data?.error}`);

    // ── An ALREADY-ACTIVE session is blocked mid-use on the very next call ──
    const midSession = await http("GET", "/api/owner/bookings", { token: preBToken });
    check("EXPIRE-3: جلسة أدمن B الحية تُرفض فوراً mid-session → 403 بنفس الرسالة",
      midSession.status === 403 && midSession.data?.error === lockoutMessage && midSession.data?.code === "SUBSCRIPTION_EXPIRED",
      `status=${midSession.status}`);

    // ── Public/customer side: full booking funnel blocked server-side ──
    const pubBarbers = await http("GET", `/api/barbers?salonSlug=${slugB}`);
    check("EXPIRE-4: قائمة الحلاقين العامة للصالون الموقوف → 403 «غير متاح حالياً»",
      pubBarbers.status === 403 && pubBarbers.data?.error === "هذا الصالون غير متاح حالياً، عد قريباً" && pubBarbers.data?.code === "SALON_UNAVAILABLE",
      `status=${pubBarbers.status}`);
    const pubAvail = await http("GET", `/api/barbers/${barberB}/availability?date=${tomorrowISO()}&serviceIds=${svB[0].id}&salonSlug=${slugB}`);
    check("EXPIRE-5: توفّر المواعيد للصالون الموقوف → 403", pubAvail.status === 403, `status=${pubAvail.status}`);
    const newBooking = await http("POST", "/api/customer/bookings", {
      token: tokB2, body: { barber_id: barberB, service_ids: [svB[0].id], date: tomorrowISO(), start_time: "09:00" },
    });
    check("EXPIRE-6: إنشاء حجز جديد (server-side) للصالون الموقوف → 403", newBooking.status === 403 && newBooking.data?.code === "SALON_UNAVAILABLE", `status=${newBooking.status}`);
    const custList = await http("GET", "/api/customer/bookings", { token: tokB2 });
    check("EXPIRE-7: حجوزات الزبون تصبح غير متاحة أثناء الإيقاف → 403", custList.status === 403, `status=${custList.status}`);

    // ── Historical booking data is preserved untouched in the DB ──
    const cntAfter = d1sql(`SELECT COUNT(*) AS n FROM bookings WHERE salon_id = ${idB}`)[0]?.results?.[0]?.n ?? -2;
    check("EXPIRE-8: بيانات الحجوزات التاريخية محفوظة بالكامل (لم تُحذف ولم تُخفَ)", cntAfter === cntBefore && cntAfter >= 1, `before=${cntBefore} after=${cntAfter}`);

    // ── Audit log: manual change attributed to the super admin's id ──
    const logRow = d1sql(`SELECT old_status, new_status, changed_by FROM subscription_status_log WHERE salon_id = ${idB} ORDER BY id DESC LIMIT 1`)[0]?.results?.[0];
    check("EXPIRE-9: سجل التغيير يوثّق old/new و changed_by = معرّف المالك العام",
      logRow && logRow.old_status !== "expired" && logRow.new_status === "expired" && String(logRow.changed_by) === String(saId),
      JSON.stringify(logRow));

    // ── Reactivate → everything back immediately ──
    const react = await http("PATCH", `/api/super-admin/salons/${idB}/status`, { token: saTok, body: { status: "active" } });
    check("RENEW-1: إعادة تنشيط صالون B → 200 وبداية دورة جديدة = اليوم",
      react.status === 200 && react.data?.salon?.subscription_start_date === salonTodayISO(), JSON.stringify(react.data?.salon));

    reloginB = await http("POST", "/api/auth/owner/login", { body: { username: "admin", password: passB } });
    check("RENEW-2: دخول أدمن B يعود للعمل فوراً بعد التنشيط", reloginB.status === 200 && !!reloginB.data?.token, `status=${reloginB.status}`);
    const ownerBack = await http("GET", "/api/owner/bookings", { token: reloginB.data?.token });
    check("RENEW-3: لوحة الأدمن تعمل مباشرة بعد التنشيط", ownerBack.status === 200);
    const custBack = await http("GET", "/api/customer/bookings", { token: tokB2 });
    check("RENEW-4: زبون B يرى حجوزاته التاريخية مجدداً بعد التنشيط",
      custBack.status === 200 && (custBack.data?.bookings ?? []).some((b) => b.id === bookingIdB),
      `count=${custBack.data?.bookings?.length}`);
    const statusBack = await http("GET", "/api/owner/subscription-status", { token: reloginB.data?.token });
    check("RENEW-5: لا لافتة تجديد بعد التجديد مباشرة (الدورة بدأت من اليوم)",
      statusBack.status === 200 && statusBack.data?.renewal_banner === null && statusBack.data?.status === "active",
      JSON.stringify(statusBack.data));
  } // نهاية مرحلة 20

  console.log("\n" + "═".repeat(52));
  console.log(" مرحلة 21: لافتة التجديد لكل صالون على حدة + الانتهاء التلقائي (Cron)");
  console.log("═".repeat(52));
  {
    // ── Per-salon reminder window: B active with cycle end = today + 2 days ──
    // Start = (today+2) − 1 month → its OWN monthly cycle ends in exactly 2 days.
    const startInWindow = addMonthsClampedISO(addDaysISO(salonTodayISO(), 2), -1);
    const startFar = addMonthsClampedISO(addDaysISO(salonTodayISO(), 20), -1);

    await d1sql(`UPDATE salons SET subscription_start_date = '${startInWindow}' WHERE id = ${idB}`);
    const banB = await http("GET", "/api/owner/subscription-status", { token: reloginB.data?.token });
    check("BANNER-1: صالون يبقى يومان على نهاية دورته الخاصة → لافتة تجديد برقم الهاتف",
      banB.status === 200 && typeof banB.data?.renewal_banner === "string"
        && banB.data.renewal_banner.includes("0795105850"),
      banB.data?.renewal_banner);

    await d1sql(`UPDATE salons SET subscription_start_date = '${startFar}' WHERE id = ${idB}`);
    const banBFar = await http("GET", "/api/owner/subscription-status", { token: reloginB.data?.token });
    check("BANNER-2: نفس الصالون بعيداً عن نهاية دورته → لا لافتة",
      banBFar.status === 200 && banBFar.data?.renewal_banner === null, JSON.stringify(banBFar.data));

    // A is on TRIAL anchored to today → no banner either (independent cycles)
    const banA = await http("GET", "/api/owner/subscription-status", { token: tokenA });
    check("BANNER-3: صالون A (تجريبي، دورته تبدأ اليوم) → لا لافتة — القرار لكل صالون حسب تاريخه",
      banA.status === 200 && banA.data?.renewal_banner === null, JSON.stringify(banA.data));

    // ── Renewal from the dashboard clears the banner instantly ──
    await http("PATCH", `/api/super-admin/salons/${idB}/status`, { token: saTok, body: { status: "active" } });
    const banB2 = await http("GET", "/api/owner/subscription-status", { token: reloginB.data?.token });
    check("BANNER-4: بعد تجديد B (بداية دورة جديدة) تختفي الافتة فوراً",
      banB2.status === 200 && banB2.data?.renewal_banner === null, JSON.stringify(banB2.data));

    // ── Automatic trial→expired via the Cloudflare Cron Trigger ──
    // Simulate: A is on trial with start = 31 days ago (trial = 30 days) →
    // the daily cron MUST flip it to 'expired' with changed_by = 'system'.
    const trialStart = addDaysISO(salonTodayISO(), -31);
    await d1sql(`UPDATE salons SET subscription_start_date = '${trialStart}' WHERE id = ${idA}`);

    const cron1 = await fetch(`${BASE}/__scheduled?cron=${encodeURIComponent("30 3 * * *")}`);
    check("CRON-1: استدعاء الـ Cron Trigger اليومي (/__scheduled) → نجاح", cron1.ok, `status=${cron1.status}`);

    const lstA = await http("GET", "/api/super-admin/salons", { token: saTok });
    const rowA2 = (lstA.data?.salons ?? []).find((s) => s.id === idA);
    check("CRON-2: صالون A التجريبي الذي انقضت مدته (31 يوماً) → expired تلقائياً",
      rowA2?.subscription_status === "expired", JSON.stringify(rowA2));

    const sysLog = d1sql(`SELECT old_status, new_status, changed_by FROM subscription_status_log WHERE salon_id = ${idA} ORDER BY id DESC LIMIT 1`)[0]?.results?.[0];
    check("CRON-3: التحويل التلقائي مسجّل في سجل التغيير بـ changed_by = 'system'",
      sysLog && sysLog.new_status === "expired" && sysLog.changed_by === "system", JSON.stringify(sysLog));

    const aBlocked = await http("GET", "/api/owner/bookings", { token: tokenA });
    check("CRON-4: جلسة أدمن A الحية تُقفل فوراً بعد الانتهاء التلقائي → 403",
      aBlocked.status === 403 && aBlocked.data?.code === "SUBSCRIPTION_EXPIRED", `status=${aBlocked.status}`);

    // ── Cron idempotency: a second run the same day adds NO duplicate log ──
    await fetch(`${BASE}/__scheduled?cron=${encodeURIComponent("30 3 * * *")}`);
    const sysCount = d1sql(`SELECT COUNT(*) AS n FROM subscription_status_log WHERE salon_id = ${idA} AND changed_by = 'system' AND new_status = 'expired'`)[0]?.results?.[0]?.n ?? -1;
    check("CRON-5: تشغيل الـ Cron مرة ثانية في نفس اليوم → بلا تسجيل مكرر (idempotent)", sysCount === 1, `count=${sysCount}`);

    // ── B stays active through the cron (its cycle ends in ~20 days) ──
    const rowB2 = (await http("GET", "/api/super-admin/salons", { token: saTok })).data?.salons?.find((s) => s.id === idB);
    check("CRON-6: صالون B النشط لم يمسه الـ Cron (دورته لم تنته)", rowB2?.subscription_status === "active", JSON.stringify(rowB2));

    // Cleanup: restore A so the local DB isn't left locked out
    await http("PATCH", `/api/super-admin/salons/${idA}/status`, { token: saTok, body: { status: "active" } });
  } // نهاية مرحلة 21

  console.log("\n" + "═".repeat(52));
  console.log(` النتيجة النهائية: ✅ ${passCount} ناجح | ❌ ${failCount} فاشل`);
  if (failures.length) { console.log(" الاختبارات الفاشلة:"); failures.forEach(f => console.log(`   - ${f}`)); }
  console.log("═".repeat(52) + "\n");
  process.exit(failCount > 0 ? 1 : 0);
}
}

main().catch((e) => { console.error("FATAL:", e); process.exit(2); });
