"use client";

/**
 * Shared unread-notification badge state (admin sidebar / bottom bar).
 *
 * Tiny module-level pub-sub: the badge lives in AdminClientLayout, but the
 * notifications page (/admin/notifications) must be able to update it the
 * moment "تعليم الكل كمقروء" or "مسح الكل" succeeds — without a page reload
 * and without prop-drilling through the layout. Live WebSocket notifications
 * increment it from the layout's own useLiveNotifications listener, so badge
 * and NotificationHub stay in sync.
 */

import { useEffect, useState } from "react";

type Listener = (count: number) => void;

let current = 0;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => {
    try {
      l(current);
    } catch {
      /* subscriber errors must never break the badge */
    }
  });
}

/** Replace the badge count (e.g. after mark-all-read / clear-all / refetch). */
export function setUnreadBadgeCount(count: number) {
  current = Math.max(0, count);
  notify();
}

/** A new unread notification arrived live (NotificationHub WebSocket). */
export function incrementUnreadBadge() {
  current += 1;
  notify();
}

/** Current value without subscribing (for imperative reads). */
export function getUnreadBadgeCount(): number {
  return current;
}

/**
 * React binding: [count, setCount, increment].
 * All subscribers update synchronously on every change.
 */
export function useUnreadBadge(): [number, (n: number) => void, () => void] {
  const [count, setCount] = useState(current);

  useEffect(() => {
    const listener: Listener = (c) => setCount(c);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return [count, setUnreadBadgeCount, incrementUnreadBadge];
}
