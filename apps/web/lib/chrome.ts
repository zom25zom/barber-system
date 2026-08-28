// Shared UI chrome (Navbar, CustomerBottomBar) must be hidden on
// public/unauthenticated pages that render only their own form content.
export function shouldHideSharedChrome(pathname: string): boolean {
  if (pathname === "/signup") return true;
  // Covers /admin/login and tenant-scoped /[salonSlug]/admin/login
  return pathname === "/admin/login" || pathname.endsWith("/admin/login");
}
