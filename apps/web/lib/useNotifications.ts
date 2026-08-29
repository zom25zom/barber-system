"use client";

import { useEffect, useRef } from "react";
import { getWsUrl } from "./api";
import { getCustomerToken, getOwnerToken } from "./auth";
import { buildTenantUrl } from "./salonTenant";
import { useToast } from "@/components/Toaster";
import { playNotificationSound, showBrowserNotification, requestNotificationPermission } from "./audio";
import type { AppNotification } from "./types";

type Listener = (n: AppNotification) => void;

class NotificationManager {
  private ws: WebSocket | null = null;
  private role: "customer" | "owner" | null = null;
  private token: string | null = null;
  private listeners: Set<Listener> = new Set();
  private recentMessages: Set<string> = new Set();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;

  public subscribe(role: "customer" | "owner", listener?: Listener, toastFn?: (msg: string) => void) {
    if (listener) this.listeners.add(listener);

    const token = role === "customer" ? getCustomerToken() : getOwnerToken();
    if (!token) return;

    // If role or token changed, re-establish connection
    if (this.role !== role || this.token !== token || !this.ws || this.ws.readyState >= WebSocket.CLOSING) {
      this.role = role;
      this.token = token;
      this.connect(toastFn);
    }
  }

  public unsubscribe(listener?: Listener) {
    if (listener) this.listeners.delete(listener);
  }

  private connect(toastFn?: (msg: string) => void) {
    if (!this.role || !this.token) return;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }

    try {
      const wsBase = getWsUrl();
      this.ws = new WebSocket(`${wsBase}/api/notifications/ws?role=${this.role}&token=${encodeURIComponent(this.token)}`);
    } catch {
      this.scheduleReconnect(toastFn);
      return;
    }

    this.ws.onopen = () => {
      this.attempts = 0;
    };

    this.ws.onmessage = (ev) => {
      try {
        const n = JSON.parse(ev.data as string) as AppNotification;
        if (!n || !n.message) return;

        // Deduplication key
        const key = `${n.id || ""}-${n.message}`;
        if (this.recentMessages.has(key)) return;
        this.recentMessages.add(key);
        setTimeout(() => this.recentMessages.delete(key), 4000);

        // 1. Play sound chime once
        playNotificationSound();

        // 2. Show native OS / browser notification once
        // Click target must be tenant-scoped: customers land on their
        // salon's /my-bookings; owners go to the (session-global) admin.
        const clickUrl = this.role === "owner" ? "/admin/bookings" : buildTenantUrl("/my-bookings");
        const title = this.role === "owner" ? "صالون الحلاقة — حجز جديد أو تعديل 💈" : "صالون الحلاقة — إشعار جديد 💈";
        showBrowserNotification(title, n.message, clickUrl);

        // 3. Show in-app toast
        toastFn?.(n.message);

        // 4. Notify all registered subscribers
        this.listeners.forEach((cb) => {
          try {
            cb(n);
          } catch {
            // ignore subscriber error
          }
        });
      } catch {
        // ignore malformed frame
      }
    };

    this.ws.onclose = () => this.scheduleReconnect(toastFn);
    this.ws.onerror = () => this.ws?.close();
  }

  private scheduleReconnect(toastFn?: (msg: string) => void) {
    if (this.timer) clearTimeout(this.timer);
    this.attempts += 1;
    const delay = Math.min(1000 * 2 ** this.attempts, 15000);
    this.timer = setTimeout(() => this.connect(toastFn), delay);
  }
}

const globalManager = new NotificationManager();

/**
 * Singleton Live notifications manager over WebSocket with sound + native system notifications.
 * Automatically deduplicates and shares a single connection across all components.
 */
export function useLiveNotifications(
  role: "customer" | "owner",
  onNotification?: (n: AppNotification) => void,
) {
  const toast = useToast();
  const cbRef = useRef(onNotification);
  cbRef.current = onNotification;

  useEffect(() => {
    requestNotificationPermission(role);

    const listener: Listener = (n) => cbRef.current?.(n);
    globalManager.subscribe(role, listener, toast);

    return () => {
      globalManager.unsubscribe(listener);
    };
  }, [role, toast]);
}

/** Simple polling helper (fallback for notification lists). */
export function usePoll(cb: () => void, ms: number) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    const id = setInterval(() => cbRef.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}
