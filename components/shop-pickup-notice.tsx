"use client";

import { usePathname } from "next/navigation";

export function ShopPickupNotice() {
  const pathname = usePathname();

  if (pathname === "/shop/stampa-documenti" || pathname.startsWith("/shop/stampa-documenti/")) {
    return null;
  }

  return (
    <div className="shop-shell-pickup-notice" role="status">
      <span>Ritiro in negozio</span>
      <strong>Al momento non effettuiamo spedizioni.</strong>
    </div>
  );
}
