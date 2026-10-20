export const SHOP_PUBLIC_HOSTNAME = "shop.28print.it";

export function isShopPublicHostname(hostname: string | null | undefined) {
  return String(hostname || "").trim().toLowerCase().replace(/:\d+$/, "") === SHOP_PUBLIC_HOSTNAME;
}

export function getShopHostRoute(pathname: string, hostname: string | null | undefined) {
  if (!isShopPublicHostname(hostname)) return "other-host" as const;
  if (pathname === "/") return "shop-home" as const;
  if (
    pathname === "/shop" || pathname.startsWith("/shop/") ||
    pathname === "/api/shop" || pathname.startsWith("/api/shop/") ||
    pathname === "/favicon.ico" || pathname === "/manifest.webmanifest"
  ) {
    return "shop-route" as const;
  }
  return "not-found" as const;
}
