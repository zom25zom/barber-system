// Shared UI chrome (Navbar, CustomerBottomBar) must be hidden on
// public/unauthenticated pages that render only their own form content.
export function shouldHideSharedChrome(pathname: string): boolean {
  // Root `/` is the public SaaS marketing landing page — fully static,
  // session-free, with its own header/footer. No salon-branded chrome.
  if (pathname === "/") return true;
  if (pathname === "/signup") return true;
  // Covers /admin/login and tenant-scoped /[salonSlug]/admin/login
  return pathname === "/admin/login" || pathname.endsWith("/admin/login");
}
