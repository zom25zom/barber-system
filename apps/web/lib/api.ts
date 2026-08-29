/**
 * API base URL.
 * • Same-origin deployments: empty → relative /api/... paths
 * • Split deployments (SSR web worker + API worker): set
 *   NEXT_PUBLIC_API_BASE_URL at web build-time, e.g. https://barber-api.<account>.workers.dev
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

export function getWsUrl(): string {
  const proto = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  if (API_BASE) {
    return `${proto}//${API_BASE.replace(/^https?:\/\//, "")}`;
  }
  if (typeof window !== "undefined") {
    return `${proto}//${window.location.host}`;
  }
  // SSR fallback — API_BASE host when set, otherwise no usable WS URL in dev.
  return API_BASE ? `${proto}//${API_BASE.replace(/^https?:\/\//, "")}` : "";
}

type ApiOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

import { clearCustomerAuth, clearOwnerToken, clearSuperAdminToken } from "./auth";

/**
 * Fetch helper that calls the API using same-origin relative paths (/api/...)
 * with automatic translation to friendly Arabic error messages.
 */
export async function apiFetch<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, token } = opts;
  let res: Response;

  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error("تعذر الاتصال بالخادم، يرجى التأكد من اتصال الإنترنت والمحاولة مرة أخرى.");
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    // Single-active-session enforcement: the server told us this token was
    // revoked/superseded (logged in from another device, password change…).
    // Clear the stored auth for the matching role and notify SessionGuard —
    // which redirects the user to the correct login page. Never silently
    // keep the user on an authenticated-looking screen.
    if (data.code === "SESSION_EXPIRED") {
      const role = path.startsWith("/api/owner/")
        ? "owner"
        : path.startsWith("/api/customer/")
          ? "customer"
          : path.startsWith("/api/super-admin/")
            ? "super-admin"
            : null;
      if (role === "owner") clearOwnerToken();
      else if (role === "customer") clearCustomerAuth();
      else if (role === "super-admin") clearSuperAdminToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("bs-session-expired", { detail: { role } }));
      }
      throw new Error(
        typeof data.error === "string" && data.error
          ? data.error
          : "انتهت صلاحية جلستك، يرجى تسجيل الدخول من جديد.",
      );
    }

    // Structured error: attach the server's machine-readable code (and any
    // public, this-salon-only metadata like salon_name) to the thrown Error
    // so pages can react (e.g. NOT_REGISTERED_THIS_SALON → register modal).
    if (typeof data.code === "string" && data.code && data.code !== "SESSION_EXPIRED") {
      const structured = new Error(
        typeof data.error === "string" && data.error
          ? data.error
          : "حدث خطأ غير متوقع أثناء معالجة الطلب.",
      ) as Error & { code?: string; salon_name?: string };
      structured.code = data.code;
      if (typeof data.salon_name === "string") structured.salon_name = data.salon_name;
      throw structured;
    }

    if (typeof data.error === "string" && data.error.trim().length > 0) {
      throw new Error(data.error);
    }

    // Friendly Arabic error fallbacks based on HTTP status codes
    switch (res.status) {
      case 400:
        throw new Error("بيانات غير صالحة، يرجى التحقق من المدخلات والمحاولة مجدداً.");
      case 401:
        throw new Error("غير مصرح أو انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً.");
      case 403:
        throw new Error("ليس لديك الصلاحية لتنفيذ هذا الإجراء.");
      case 404:
        throw new Error("العنصر المطلوب غير موجود أو تم حذفه مسبقاً.");
      case 409:
        throw new Error("تعارض في البيانات: الموعد أو السجل محجوز مسبقاً.");
      case 429:
        throw new Error("تم تجاوز الحد المسموح للمحاولات. يرجى الانتظار والمحاولة لاحقاً.");
      case 500:
      case 502:
      case 503:
        throw new Error("حدث خطأ في الخادم، يرجى المحاولة بعد لحظات.");
      default:
        throw new Error("حدث خطأ غير متوقع أثناء معالجة الطلب.");
    }
  }

  return data as T;
}
