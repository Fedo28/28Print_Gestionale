import { BillboardAssetKind } from "@prisma/client";
import { BillboardsWorkspace } from "@/components/billboards-workspace";
import { requireAuth } from "@/lib/auth";
import { formatDateKey } from "@/lib/format";
import { getBillboardSurface } from "@/lib/billboards";
import { getCustomers } from "@/lib/orders";

export const dynamic = "force-dynamic";

type BillboardsFocus = "assets" | "occupied" | "free" | "bookings" | "day";
type BillboardKindFilter = "ALL" | BillboardAssetKind;
type BillboardDayView = "bookings" | "occupied" | "free";

type BillboardPageProps = {
  searchParams?: {
    date?: string;
    asset?: string;
    booking?: string;
    focus?: string;
    day?: string;
    kind?: string;
    dayView?: string;
  };
};

export default async function BillboardsPage({ searchParams }: BillboardPageProps) {
  await requireAuth();

  const focusDate = parseDateParam(searchParams?.date);
  const activeFocus = parseFocus(searchParams?.focus);
  const activeKind = parseKind(searchParams?.kind);
  const activeDayView = parseDayView(searchParams?.dayView);
  const selectedDay = parseOptionalDayParam(searchParams?.day);
  const isBookingOpen = searchParams?.booking === "new";
  const selectedAssetCode = (searchParams?.asset || "").trim() || null;
  const [customers, surface] = await Promise.all([getCustomers(), getBillboardSurface(focusDate)]);

  return (
    <BillboardsWorkspace
      assets={surface.assets.map((asset) => ({
        id: asset.id,
        code: asset.code,
        name: asset.name,
        kind: asset.kind,
        location: asset.location,
        sortOrder: asset.sortOrder,
        bookings: asset.bookings.map((booking) => ({
          id: booking.id,
          billboardAssetId: asset.id,
          startsAt: formatDateKey(booking.startsAt),
          endsAt: formatDateKey(booking.endsAt),
          priceCents: booking.priceCents,
          paidCents: booking.paidCents,
          balanceDueCents: booking.balanceDueCents,
          monitorSlot: booking.monitorSlot,
          customer: {
            name: booking.customer.name
          }
        }))
      }))}
      customers={customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        whatsapp: customer.whatsapp,
        email: customer.email,
        pec: customer.pec,
        taxCode: customer.taxCode,
        vatNumber: customer.vatNumber,
        uniqueCode: customer.uniqueCode,
        type: customer.type,
        orderCount: customer.orders.length
      }))}
      initialAssetCode={selectedAssetCode}
      initialBookingOpen={isBookingOpen}
      initialDayKey={selectedDay ? formatDateKey(selectedDay) : null}
      initialDayView={activeDayView}
      initialFocus={activeFocus}
      initialKind={activeKind}
      monthBookings={surface.monthBookings.map((booking) => ({
        id: booking.id,
        billboardAssetId: booking.billboardAssetId,
        startsAt: formatDateKey(booking.startsAt),
        endsAt: formatDateKey(booking.endsAt),
        priceCents: booking.priceCents,
        paidCents: booking.paidCents,
        balanceDueCents: booking.balanceDueCents,
        monitorSlot: booking.monitorSlot,
        customer: {
          name: booking.customer.name
        },
        billboardAsset: {
          id: booking.billboardAsset.id,
          code: booking.billboardAsset.code,
          name: booking.billboardAsset.name,
          kind: booking.billboardAsset.kind,
          sortOrder: booking.billboardAsset.sortOrder
        }
      }))}
      monthDateKey={formatDateKey(focusDate)}
      monthLabel={getMonthLabel(focusDate)}
      todayKey={formatDateKey(startOfDay(new Date()))}
    />
  );
}

function parseDateParam(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return startOfMonth(new Date());
  }

  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return startOfMonth(new Date());
  }

  return startOfMonth(parsed);
}

function parseFocus(value?: string): BillboardsFocus | null {
  if (value === "assets" || value === "occupied" || value === "free" || value === "bookings" || value === "day") {
    return value;
  }

  return null;
}

function parseKind(value?: string): BillboardKindFilter {
  if (value === "CARTELLONE" || value === "MONITOR" || value === "VELA_ITINERANTE") {
    return value;
  }

  return "ALL";
}

function parseDayView(value?: string): BillboardDayView {
  if (value === "free" || value === "occupied") {
    return value;
  }

  return "bookings";
}

function parseOptionalDayParam(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return startOfDay(parsed);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0);
}

function getMonthLabel(date: Date) {
  const label = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
