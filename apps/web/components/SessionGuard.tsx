"use client";

/**
 * SessionGuard — single-active-session enforcement (client side).
 *
 * When the API reports code=SESSION_EXPIRED (this device's token was
 * revoked because the same account logged in from another device, or the
 * session expired), lib/api.ts clears the stored auth for the matching role
 * and dispatches the "bs-session-expired" event. This component listens for
 * it and redirects the user to the CORRECT login page — never leaving them
 * on an authenticated-looking screen:
 *
 *   owner    → /admin/login           (session-global admin entry point)
 *   customer → /{salonSlug}/login     (tenant-scoped; falls back to /login
 *                                       outside a tenant context)
 *   super-admin → /super-admin/login   (platform-owner realm)
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { buildTenantUrl } from "@/lib/salonTenant";
import { useToast } from "@/components/Toaster";

export default function SessionGuard() {
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    let redirecting = false;

    function onSessionExpired(ev: Event) {
      if (redirecting) return;
      redirecting = true;

      const role = (ev as CustomEvent<{ role?: "owner" | "customer" | "super-admin" | null }>)
        .detail?.role;
      const target =
        role === "owner"
          ? "/admin/login"
          : role === "super-admin"
            ? "/super-admin/login"
            : buildTenantUrl("/login");

      toast.warning("انتهت صلاحية جلستك — سيتم تحويلك لتسجيل الدخول من جديد.");
      // Small delay so the toast is perceivable before navigation.
      setTimeout(() => router.push(target), 1200);
    }

    window.addEventListener("bs-session-expired", onSessionExpired);
    return () => window.removeEventListener("bs-session-expired", onSessionExpired);
  }, [router, toast]);

  return null;
}
