"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { getOwnerToken } from "./auth";

export type SalonSettings = {
  id: number;
  name: string;
  phone: string | null;
  logo_url: string | null;
  primary_color: string;
  social_facebook?: string | null;
  social_instagram?: string | null;
  social_tiktok?: string | null;
  social_whatsapp?: string | null;
  maps_url?: string | null;
  /** trial | active | expired — present in public salon-settings responses;
   *  SSR pages use it to render the "salon unavailable" state when expired. */
  subscription_status?: string;
  // Returned only by the session-scoped owner endpoint (/api/owner/salon-settings).
  // Used to build the tenant's public booking page link (e.g. "/{slug}").
  slug?: string | null;
};

const DEFAULT_SETTINGS: SalonSettings = {
  id: 1,
  name: "صالون الحلاقة",
  phone: null,
  logo_url: null,
  primary_color: "#f59e0b",
  social_facebook: null,
  social_instagram: null,
  social_tiktok: null,
  social_whatsapp: null,
  maps_url: null,
};

const STORAGE_KEY = "salon_settings_v2_by_id";

// SECURITY/hygiene: the settings cache is keyed PER SALON ID. The previous
// single global key ("salon_settings_v1") leaked salon A's cached branding
// into salon B's admin header (until a refresh overwrote it) when browsing
// salons back-to-back on one device.
type SalonSettingsCache = { lastId: number | null; byId: Record<string, SalonSettings> };

function readSettingsCache(): SalonSettingsCache {
  if (typeof window === "undefined") return { lastId: null, byId: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SalonSettingsCache;
  } catch {}
  return { lastId: null, byId: {} };
}

function writeSettingsCache(settings: SalonSettings) {
  if (typeof window === "undefined" || !settings?.id) return;
  try {
    const cache = readSettingsCache();
    cache.byId[String(settings.id)] = settings;
    cache.lastId = settings.id;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {}
}
let cachedSettings: SalonSettings | null = null;

/**
 * Dynamically updates the browser DOM, theme-color, document title,
 * and icons in real time without requiring a page reload.
 */
export function applySalonToDOM(settings: SalonSettings) {
  if (typeof window === "undefined") return;

  try {
    const isAdmin = window.location.pathname.startsWith("/admin");

    // 1. Update theme-color meta tags
    let themeColorMeta = document.querySelector<HTMLMetaElement>("meta[name='theme-color']");
    if (!themeColorMeta) {
      themeColorMeta = document.createElement("meta");
      themeColorMeta.name = "theme-color";
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.content = settings.primary_color || "#09090b";

    // 2. Update CSS variable for custom dynamic accents
    document.documentElement.style.setProperty(
      "--primary-salon-color",
      settings.primary_color || "#f59e0b",
    );

    // 3. Update Apple Mobile App Title
    let appleTitle = document.querySelector<HTMLMetaElement>(
      "meta[name='apple-mobile-web-app-title']",
    );
    if (appleTitle) {
      appleTitle.content = isAdmin ? `إدارة ${settings.name}` : settings.name;
    }

    // 4. Update Favicon / Touch Icon if custom logo exists
    if (settings.logo_url) {
      let iconLink = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!iconLink) {
        iconLink = document.createElement("link");
        iconLink.rel = "icon";
        document.head.appendChild(iconLink);
      }
      iconLink.href = settings.logo_url;

      let appleIcon = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
      if (appleIcon) {
        appleIcon.href = settings.logo_url;
      }
    }
  } catch (err) {
    console.warn("[Salon Branding] Failed to update DOM:", err);
  }
}

/**
 * Updates client-side cache and broadcasts 'salon-settings-changed' event
 * so all components (Navbar, Admin Layout, Pages) refresh immediately without reload.
 */
export function updateSalonSettingsClient(newSettings: SalonSettings) {
  cachedSettings = newSettings;
  if (typeof window !== "undefined") {
    writeSettingsCache(newSettings);

    window.dispatchEvent(new CustomEvent("salon-settings-changed", { detail: newSettings }));
    applySalonToDOM(newSettings);
  }
}

/**
 * Hook that returns the live salon settings and subscribes to live updates.
 * Guarantees consistent initial render between Server and Client to eliminate React #418 Hydration Mismatch.
 */
export function useSalonSettings(salonSlug?: string | null): SalonSettings {
  const [settings, setSettings] = useState<SalonSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (salonSlug) {
      // Tenant-specific view: always fetch fresh for THIS slug (skip shared cache)
      apiFetch<{ salon: SalonSettings }>(`/api/salon-settings?salonSlug=${encodeURIComponent(salonSlug)}`)
        .then((d) => {
          if (d.salon) setSettings(d.salon);
        })
        .catch(() => {});
      return;
    }

    // 1. Check cached settings in memory or localStorage on client mount
    // (per-salon map — see STORAGE_KEY note above)
    if (cachedSettings) {
      setSettings(cachedSettings);
      applySalonToDOM(cachedSettings);
    } else if (typeof window !== "undefined") {
      const cache = readSettingsCache();
      const stored = cache.lastId != null ? cache.byId[String(cache.lastId)] : null;
      if (stored) {
        cachedSettings = stored;
        setSettings(stored);
        applySalonToDOM(stored);
      }
    }

    // 2. Fetch fresh settings from server
    apiFetch<{ salon: SalonSettings }>(salonSlug ? `/api/salon-settings?salonSlug=${encodeURIComponent(salonSlug)}` : "/api/salon-settings")
      .then((d) => {
        if (d.salon) {
          cachedSettings = d.salon;
          setSettings(d.salon);
          writeSettingsCache(d.salon);
          applySalonToDOM(d.salon);
        }
      })
      .catch(() => {});

    // 3. Listen to live client changes
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<SalonSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      }
    };

    window.addEventListener("salon-settings-changed", handler);
    return () => window.removeEventListener("salon-settings-changed", handler);
  }, [salonSlug]);

  return settings;
}

/**
 * Owner-scoped salon settings for the ADMIN panel.
 *
 * Fetches GET /api/owner/salon-settings — the tenant is derived from the
 * owner session server-side, so it can never leak another salon's branding
 * and never depends on a path/host slug.
 *
 * Pass enabled=false where there is no session yet (e.g. /admin/login) so
 * no request is fired at all — this eliminates the old 404 /api/salon-settings
 * noise coming from the login page.
 */
export function useOwnerSalonSettings(enabled: boolean = true): SalonSettings {
  const [settings, setSettings] = useState<SalonSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!enabled) return;
    const token = getOwnerToken();
    if (!token) return;

    apiFetch<{ salon: SalonSettings }>("/api/owner/salon-settings", { token })
      .then((d) => {
        if (d.salon) {
          setSettings(d.salon);
          applySalonToDOM(d.salon);
        }
      })
      .catch(() => {});

    // Live updates broadcast by the settings page after a successful save
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SalonSettings>).detail;
      if (detail) setSettings(detail);
    };
    window.addEventListener("salon-settings-changed", handler);
    return () => window.removeEventListener("salon-settings-changed", handler);
  }, [enabled]);

  return settings;
}
