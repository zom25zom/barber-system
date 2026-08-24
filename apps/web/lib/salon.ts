"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./api";

export type SalonSettings = {
  id: number;
  name: string;
  phone: string | null;
  logo_url: string | null;
  primary_color: string;
};

const DEFAULT_SETTINGS: SalonSettings = {
  id: 1,
  name: "صالون الحلاقة",
  phone: null,
  logo_url: null,
  primary_color: "#f59e0b",
};

const STORAGE_KEY = "salon_settings_v1";
let cachedSettings: SalonSettings | null = null;

/**
 * Dynamically updates the browser DOM, theme-color, document icon,
 * and Web App Manifest in real time without requiring a redeployment or page reload.
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
    document.documentElement.style.setProperty("--primary-salon-color", settings.primary_color || "#f59e0b");

    // 3. Update Apple Mobile App Title
    let appleTitle = document.querySelector<HTMLMetaElement>("meta[name='apple-mobile-web-app-title']");
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

    // 5. Generate and inject Dynamic Web App Manifest Blob URL
    const manifestObj = {
      name: isAdmin ? `لوحة تحكم ${settings.name} — الإدارة` : `${settings.name} — احجز موعدك`,
      short_name: isAdmin ? `إدارة ${settings.name}` : settings.name,
      description: isAdmin
        ? `لوحة تحكم وإدارة ${settings.name} والحجوزات والإشعارات`
        : `نظام حجز مواعيد ${settings.name} — اختر الحلاق والخدمة والموعد المناسب لك`,
      start_url: isAdmin ? "/admin" : "/",
      scope: isAdmin ? "/admin" : "/",
      id: isAdmin ? "/admin" : "/",
      display: "standalone",
      orientation: "portrait",
      dir: "rtl",
      lang: "ar",
      theme_color: settings.primary_color || "#09090b",
      background_color: "#09090b",
      icons: [
        {
          src: settings.logo_url || "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable",
        },
        {
          src: settings.logo_url || "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        },
      ],
      categories: isAdmin ? ["business", "utilities"] : ["lifestyle", "utilities"],
      prefer_related_applications: false,
    };

    const manifestBlob = new Blob([JSON.stringify(manifestObj, null, 2)], {
      type: "application/json",
    });
    const blobUrl = URL.createObjectURL(manifestBlob);

    let manifestLink = document.querySelector<HTMLLinkElement>("link[rel='manifest']");
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = blobUrl;
  } catch (err) {
    console.warn("[Salon Branding] Failed to update DOM manifest:", err);
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
 */
export function useSalonSettings(): SalonSettings {
  const [settings, setSettings] = useState<SalonSettings>(() => {
    if (cachedSettings) return cachedSettings;
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          cachedSettings = parsed;
          return parsed;
        }
      } catch {}
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    // 1. Apply initial DOM modifications
    applySalonToDOM(settings);

    // 2. Fetch fresh settings from server
    apiFetch<{ salon: SalonSettings }>("/api/salon-settings")
      .then((d) => {
        cachedSettings = d.salon;
        setSettings(d.salon);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(d.salon));
        } catch {}
        applySalonToDOM(d.salon);
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
