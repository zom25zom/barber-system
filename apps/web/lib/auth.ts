import type { Customer } from "./types";

const CUSTOMER_TOKEN_KEY = "barber_customer_token";
const CUSTOMER_PROFILE_KEY = "barber_customer_profile";
const OWNER_TOKEN_KEY = "barber_owner_token";

function notifyAuthChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("auth-changed"));
}

// ---------- Customer ----------

export function getCustomerToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CUSTOMER_TOKEN_KEY);
}

export function getCustomerProfile(): Customer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CUSTOMER_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Customer) : null;
  } catch {
    return null;
  }
}

export function setCustomerAuth(token: string, customer: Customer) {
  localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(customer));
  notifyAuthChanged();
}

export function clearCustomerAuth() {
  localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  localStorage.removeItem(CUSTOMER_PROFILE_KEY);
  notifyAuthChanged();
}

// ---------- Owner ----------

export function getOwnerToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(OWNER_TOKEN_KEY);
}

export function setOwnerToken(token: string) {
  localStorage.setItem(OWNER_TOKEN_KEY, token);
  notifyAuthChanged();
}

export function clearOwnerToken() {
  localStorage.removeItem(OWNER_TOKEN_KEY);
  notifyAuthChanged();
}
