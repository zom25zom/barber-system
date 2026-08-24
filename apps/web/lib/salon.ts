"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./api";

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

const STORAGE_KEY = "salon_settings_v1";
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch {}

    window.dispatchEvent(new CustomEvent("salon-settings-changed", { detail: newSettings }));
    applySalonToDOM(newSettings);
  }
}

/**
 * Hook that returns the live salon settings and subscribes to live updates.
 * Guarantees consistent initial render between Server and Client to eliminate React #418 Hydration Mismatch.
 */
export function useSalonSettings(): SalonSettings {
  const [settings, setSettings] = useState<SalonSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    // 1. Check cached settings in memory or localStorage on client mount
    if (cachedSettings) {
      setSettings(cachedSettings);
      applySalonToDOM(cachedSettings);
    } else if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          cachedSettings = parsed;
          setSettings(parsed);
          applySalonToDOM(parsed);
        }
      } catch {}
    }

    // 2. Fetch fresh settings from server
    apiFetch<{ salon: SalonSettings }>("/api/salon-settings")
      .then((d) => {
        if (d.salon) {
          cachedSettings = d.salon;
          setSettings(d.salon);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(d.salon));
          } catch {}
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
  }, []);

  return settings;
}
