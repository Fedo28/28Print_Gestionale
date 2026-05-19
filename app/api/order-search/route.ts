import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth-core";
import {
  parseCustomerTypeFilter,
  parseDashboardPreset,
  parseInvoiceFilter,
  parseOrderListView,
  parsePaymentFilter,
  parsePhaseFilter,
  parsePriorityFilter,
  parseStatusFilter
} from "@/lib/order-filters";
import { getOrderSearchSuggestions } from "@/lib/orders";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!readSession(request.cookies.get("fede_session")?.value)) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const scope = request.nextUrl.searchParams.get("scope") === "quotes" ? "quotes" : "orders";
  const query = request.nextUrl.searchParams.get("q") || "";
  const items = await getOrderSearchSuggestions({
    view: parseOrderListView(request.nextUrl.searchParams.get("view")),
    query,
    phase: parsePhaseFilter(request.nextUrl.searchParams.get("phase")),
    status: parseStatusFilter(request.nextUrl.searchParams.get("status")),
    payment: parsePaymentFilter(request.nextUrl.searchParams.get("payment")),
    invoice: parseInvoiceFilter(request.nextUrl.searchParams.get("invoice")),
    priority: parsePriorityFilter(request.nextUrl.searchParams.get("priority")),
    customerType: parseCustomerTypeFilter(request.nextUrl.searchParams.get("customerType")),
    preset: parseDashboardPreset(request.nextUrl.searchParams.get("preset")),
    quote: scope === "quotes" ? "QUOTE" : "ORDER",
    limit: 6
  });

  return NextResponse.json({ items });
}
