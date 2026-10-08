"use client";

import Link from "next/link";

export function OrderPrintButton({ orderId }: { orderId: string }) {
  return (
    <Link className="button ghost print-brand-trigger" href={`/orders/${orderId}/print`} prefetch={false}>
      Stampa
    </Link>
  );
}
