export function getWsUrl(): string {
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}`;
  }
  return "ws://localhost:8787";
}

export const WS_URL = "ws://localhost:8787";

type ApiOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

/**
 * Fetch helper that calls the API using same-origin relative paths (/api/...)
 * with automatic translation to friendly Arabic error messages.
 */
export async function apiFetch<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, token } = opts;
  let res: Response;

  try {
    res = await fetch(path, {
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
