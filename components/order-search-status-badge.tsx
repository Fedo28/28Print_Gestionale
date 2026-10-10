import type { OrderSearchStatus } from "@/lib/order-search-status";

export function OrderSearchStatusBadge({ status }: { status?: OrderSearchStatus }) {
  return status ? <span className={`search-order-status status-${status.tone}`}>{status.label}</span> : null;
}
