import Link from "next/link";
import type { MainPhase } from "@prisma/client";
import { quickUpdatePhaseAction } from "@/app/actions";
import { ReadyWhatsAppButton } from "@/components/ready-whatsapp-button";
import { operationalStatusLabels, purchaseNoteUrgencyLabels } from "@/lib/constants";
import { formatCompactDate, formatCurrency, formatDateKey, formatDateTime } from "@/lib/format";
import { getDisplayOrderLabel } from "@/lib/order-display";
import { buildOrdersFilterHref } from "@/lib/order-filters";
import { getDashboardData, type DashboardWeekDayLoad } from "@/lib/orders";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
type DashboardOrder = DashboardData["todayOrders"][number];
type DashboardPurchaseNote = DashboardData["purchaseNotes"]["pending"][number];
type DashboardFocus = "PRIORITY" | "TOMORROW" | "TO_START" | "WORKING" | "BLOCKED" | "READY";
type DashboardDayFocus = "ALL" | "WORKLOAD" | "APPOINTMENTS";
type DashboardReadyMode = "TO_NOTIFY" | "NOTIFIED";
type DashboardMetricTone = "blue" | "cyan" | "ink" | "lime" | "red";
type DashboardWeekTone = "blue" | "cyan" | "lime" | "quiet" | "red";
type DashboardPulse = "CALENDAR" | "DAY" | "PRIORITY" | "TO_START" | "WORKING" | "LATE_START" | "BLOCKED" | "READY" | "FINANCE" | "FINANCE_AGED" | "TOMORROW";
const DASHBOARD_CLEAN_VISIBLE_LIMIT = 7;

export async function DashboardPage({
  focus,
  day,
  dayFocus,
  readyMode,
  pulse
}: {
  panel?: string;
  focus?: string;
  day?: string;
  dayFocus?: string;
  readyMode?: string;
  financeMode?: string;
  financeBucket?: string;
  financeSort?: string;
  materials?: string;
  pulse?: string;
}) {
  const dashboardData = await getDashboardData();
  const {
    blockedOrders,
    readyOrders,
    invoiceOrders,
    priorityOrders,
    toStartOrders,
    workingOrders,
    weekOrders,
    weekLoad,
    purchaseNotes
  } = dashboardData;

  const nextAppointment = getNextUpcomingAppointment(weekOrders);
  const requestedFocus = parseDashboardFocus(focus);
  const activeDayFocus = parseDashboardDayFocus(dayFocus);
  const activePulse = parseDashboardPulse(pulse);
  const selectedDay = getSelectedDashboardDay(weekLoad, day);
  const selectedDayAllOrders = selectedDay ? getOrdersForDashboardDay(weekOrders, selectedDay.date) : [];
  const selectedDayOrders = selectedDay ? filterDashboardDayOrders(selectedDayAllOrders, selectedDay.date, activeDayFocus) : [];
  const totalInvoicableCents = invoiceOrders.reduce((sum, order) => sum + order.totalCents, 0);
  const readyOrdersToNotify = readyOrders.filter((order) => !order.readyWhatsappSentAt);
  const readyOrdersNotified = readyOrders.filter((order) => Boolean(order.readyWhatsappSentAt));
  const activeReadyMode = getDashboardReadyMode(readyMode, readyOrdersToNotify.length);
  const invoiceOrdersSorted = [...invoiceOrders].sort(
    (left, right) => getDashboardFinanceReferenceDate(left).getTime() - getDashboardFinanceReferenceDate(right).getTime()
  );
  const financePaidOrders = invoiceOrdersSorted.filter((order) => order.paymentStatus === "PAGATO");
  const stalePaidInvoiceOrders = financePaidOrders.filter((order) => getDashboardDateAgeInDays(getDashboardFinanceReferenceDate(order)) > 7);
  const featuredPurchaseNote = getDashboardFeaturedPurchaseNote(purchaseNotes.pending);
  const deliveredInvoiceOrders = invoiceOrders.filter((order) => order.mainPhase === "CONSEGNATO");
  const tomorrowDate = getTomorrowDashboardDate();
  const lateStartOrders = toStartOrders.filter((order) => new Date(order.deliveryAt).getTime() < tomorrowDate.getTime());
  const tomorrowOrders = getTomorrowDashboardOrders(weekOrders, tomorrowDate);
  const tomorrowOrdersToStart = tomorrowOrders.filter((order) => order.mainPhase === "ACCETTATO");
  const suggestedFocus = getRecommendedDashboardFocus({
    blockedCount: blockedOrders.length,
    lateStartCount: lateStartOrders.length,
    priorityCount: priorityOrders.length,
    readyCount: readyOrders.length,
    readyToNotifyCount: readyOrdersToNotify.length,
    tomorrowToStartCount: tomorrowOrdersToStart.length,
    toStartCount: toStartOrders.length
  });
  const activeFocus = selectedDay ? requestedFocus : focus ? requestedFocus : suggestedFocus;
  const readyOrdersVisible = activeReadyMode === "NOTIFIED" ? readyOrdersNotified : readyOrdersToNotify;
  const materialsOpenCount = purchaseNotes.stats.open;
  const materialsBlockingCount = purchaseNotes.stats.blocking;
  const materialsWaitingCount = purchaseNotes.stats.waitingMaterial;
  const materialsActionCount = materialsBlockingCount > 0 ? materialsBlockingCount : materialsWaitingCount;
  const hasMaterialsSignal = materialsOpenCount > 0;
  const links = {
    priorityToday: buildOrdersFilterHref({ preset: "PRIORITY_TODAY" }),
    toStart: buildOrdersFilterHref({ preset: "TO_START" }),
    working: buildOrdersFilterHref({ preset: "WORKING" }),
    blocked: buildOrdersFilterHref({ preset: "BLOCKED" }),
    ready: buildOrdersFilterHref({ preset: "READY" }),
    financePaidAged: buildOrdersFilterHref({ preset: "FINANCE_PAID_AGED" }),
    financeAll: buildOrdersFilterHref({ preset: "BALANCE" }),
    financeDelivered: buildOrdersFilterHref({ view: "DELIVERED", invoice: "DA_FATTURARE" }),
    tomorrow: buildOrdersFilterHref({ preset: "TOMORROW", sort: "delivery" }),
    materialsWaiting: buildOrdersFilterHref({ status: "IN_ATTESA_MATERIALE" }),
    purchaseNotes: "/purchase-notes"
  };
  const productionLinks = {
    priority: buildDashboardProductionHref("PRIORITY"),
    toStart: buildDashboardProductionHref("TO_START", { pulse: lateStartOrders.length > 0 ? "LATE_START" : "TO_START" }),
    working: buildDashboardProductionHref("WORKING"),
    blocked: buildDashboardProductionHref("BLOCKED"),
    ready: buildDashboardProductionHref("READY", {
      readyMode: readyOrdersToNotify.length > 0 ? "TO_NOTIFY" : "NOTIFIED"
    }),
    tomorrow: buildDashboardProductionHref("TOMORROW")
  };
  const productionTracks = [
    {
      focus: "PRIORITY",
      href: productionLinks.priority,
      label: "Priorita",
      tone: priorityOrders.length > 0 ? "red" : "ink",
      value: priorityOrders.length
    },
    {
      focus: "TO_START",
      href: productionLinks.toStart,
      label: "Da avviare",
      tone: "lime",
      value: toStartOrders.length
    },
    {
      focus: "WORKING",
      href: productionLinks.working,
      label: "In corso",
      tone: "blue",
      value: workingOrders.length
    },
    {
      focus: "READY",
      href: productionLinks.ready,
      label: "Pronti",
      tone: "cyan",
      value: readyOrders.length
    }
  ] satisfies Array<{
    focus: DashboardFocus;
    href: string;
    label: string;
    tone: DashboardMetricTone;
    value: number;
  }>;
  const productionSignals = [
    lateStartOrders.length > 0
      ? {
          active: activeFocus === "TO_START",
          href: productionLinks.toStart,
          label: "Ritardo",
          tone: "red",
          value: lateStartOrders.length
        }
      : null,
    blockedOrders.length > 0
      ? {
          active: activeFocus === "BLOCKED",
          href: productionLinks.blocked,
          label: "Sospesi",
          tone: "red",
          value: blockedOrders.length
        }
      : null,
    readyOrdersToNotify.length > 0
      ? {
          active: activeFocus === "READY",
          href: productionLinks.ready,
          label: "Da avvisare",
          tone: "cyan",
          value: readyOrdersToNotify.length
        }
      : null,
    tomorrowOrdersToStart.length > 0
      ? {
          active: activeFocus === "TOMORROW",
          href: productionLinks.tomorrow,
          label: "Domani",
          tone: "blue",
          value: tomorrowOrdersToStart.length
        }
      : null
  ].filter(
    (item): item is {
      active: boolean;
      href: string;
      label: string;
      tone: DashboardMetricTone;
      value: number;
    } => Boolean(item)
  );
  const nextAppointmentDetail = nextAppointment
    ? `${getDisplayOrderLabel(nextAppointment.orderCode, nextAppointment.title)} • ${formatDateTime(nextAppointment.appointmentAt || nextAppointment.deliveryAt)}`
    : "";
  const financeQuickActions = [
    stalePaidInvoiceOrders.length > 0
      ? {
          href: links.financePaidAged,
          key: "invoice",
          label: "Fattura ora",
          value: stalePaidInvoiceOrders.length === 1 ? "1 ordine" : `${stalePaidInvoiceOrders.length} ordini`
        }
      : deliveredInvoiceOrders.length > 0
      ? {
          href: links.financeDelivered,
          key: "close",
          label: "Fattura ora",
          value: deliveredInvoiceOrders.length === 1 ? "1 ordine" : `${deliveredInvoiceOrders.length} ordini`
        }
      : null
  ].filter(
    (item): item is {
      href: string;
      key: string;
      label: string;
      value: string;
    } => Boolean(item)
  );
  const queueConfig = selectedDay
    ? {
        orders: selectedDayOrders,
        renderMeta: (order: DashboardOrder) => getDashboardDayOrderMeta(order, selectedDay.date),
        emptyMessage: getDashboardDayFocusEmptyMessage(activeDayFocus),
        viewHref: `/calendar?view=day&date=${selectedDay.key}`
      }
    : activeFocus === "PRIORITY"
      ? {
          orders: priorityOrders,
          renderMeta: (order: DashboardOrder) => `Consegna ${formatDateTime(order.deliveryAt)}`,
          emptyMessage: "Nessuna priorita in lavorazione con scadenza oggi o domani.",
          viewHref: links.priorityToday
        }
      : activeFocus === "TO_START"
        ? {
            orders: toStartOrders,
            renderMeta: (order: DashboardOrder) => `Consegna ${formatDateTime(order.deliveryAt)}`,
            emptyMessage: "Niente in attesa di avvio.",
            viewHref: links.toStart
          }
        : activeFocus === "WORKING"
          ? {
              orders: workingOrders,
              renderMeta: (order: DashboardOrder) => `Consegna ${formatDateTime(order.deliveryAt)}`,
              emptyMessage: "Nessun ordine in lavorazione.",
              viewHref: links.working
            }
          : activeFocus === "TOMORROW"
            ? {
                orders: tomorrowOrders,
                renderMeta: (order: DashboardOrder) => `Consegna ${formatDateTime(order.deliveryAt)}`,
                emptyMessage: "Nessuna consegna prevista per domani.",
                viewHref: links.tomorrow
              }
            : activeFocus === "BLOCKED"
              ? {
                  orders: blockedOrders,
                  renderMeta: (order: DashboardOrder) =>
                    `${operationalStatusLabels[order.operationalStatus]} • Consegna ${formatDateTime(order.deliveryAt)}`,
                  emptyMessage: "Nessun ordine sospeso in questo momento.",
                  viewHref: links.blocked
                }
              : {
                  orders: readyOrdersVisible,
                  renderMeta: (order: DashboardOrder) =>
                    `${order.readyWhatsappSentAt ? "Avvisato" : "Da avvisare"} • Consegna ${formatDateTime(order.deliveryAt)}`,
                  emptyMessage:
                    activeReadyMode === "NOTIFIED"
                      ? "Nessun ordine gia avvisato in questo momento."
                      : "Nessun ordine pronto ancora da avvisare.",
                  viewHref: links.ready
                };

  const financePrimaryAction = financeQuickActions[0];
  const shouldUseProductionFallback = !selectedDay && !focus && activeFocus === "PRIORITY" && queueConfig.orders.length === 0;
  const productionPreviewOrders =
    queueConfig.orders.length > 0 || !shouldUseProductionFallback
      ? queueConfig.orders
      : mergeUniqueOrders(toStartOrders, workingOrders, readyOrders, tomorrowOrders);
  const productionPreviewVisible = productionPreviewOrders.slice(0, DASHBOARD_CLEAN_VISIBLE_LIMIT);
  const materialsLeadHref = featuredPurchaseNote?.order ? `/orders/${featuredPurchaseNote.order.id}` : links.purchaseNotes;
  const materialsLeadLabel = featuredPurchaseNote ? purchaseNoteUrgencyLabels[featuredPurchaseNote.urgency] : "Tutto ok";
  const materialsLeadTitle = featuredPurchaseNote ? featuredPurchaseNote.customerName : "Materiali";
  const materialsLeadMeta = featuredPurchaseNote ? featuredPurchaseNote.content : "Nessuna nota aperta";
  const materialsActionHref = materialsBlockingCount > 0 ? links.purchaseNotes : links.materialsWaiting;

  return (
    <div className="dashboard-page-shell dashboard-clean-shell">
      <section className="dashboard-clean-topbar" aria-label="Azioni dashboard">
        <div className="dashboard-clean-actions">
          <Link className="dashboard-ops-button is-solid" href="/orders/new">
            Nuovo ordine
          </Link>
          <Link className="dashboard-ops-button is-light" href="/quotes/new">
            Nuovo preventivo
          </Link>
          <Link className="dashboard-ops-button is-outline" href="/customers#customers-new-entry">
            Nuovo cliente
          </Link>
        </div>
      </section>

      {nextAppointment ? (
        <Link className="dashboard-clean-appointment" href="/calendar">
          <span>Appuntamento</span>
          <strong>{nextAppointment.customer.name}</strong>
          <small>{nextAppointmentDetail}</small>
        </Link>
      ) : null}

      <section className={`dashboard-clean-grid${hasMaterialsSignal ? "" : " dashboard-clean-grid-no-materials"}`}>
        <article className={`dashboard-clean-panel dashboard-clean-production${pulseClass(activePulse, "PRIORITY", "TO_START", "WORKING", "LATE_START", "BLOCKED", "READY", "TOMORROW", "DAY")}`}>
          <div className="dashboard-clean-head">
            <strong>Produzione</strong>
            <Link href="/production">Apri</Link>
          </div>

          <div className="dashboard-clean-metrics dashboard-clean-production-metrics">
            {productionTracks.map((track) => (
              <DashboardCleanMetric
                active={!selectedDay && activeFocus === track.focus}
                href={track.href}
                key={track.focus}
                label={track.label}
                tone={track.tone}
                value={track.value}
              />
            ))}
          </div>

          {productionSignals.length > 0 ? (
            <div className="dashboard-clean-production-signals" aria-label="Segnali produzione">
              {productionSignals.map((signal) => (
                <Link
                  className={`dashboard-clean-production-signal tone-${signal.tone}${signal.active ? " is-active" : ""}`}
                  href={signal.href}
                  key={signal.label}
                >
                  <strong>{signal.value}</strong>
                  <span>{signal.label}</span>
                </Link>
              ))}
            </div>
          ) : null}

          <div className="dashboard-clean-list" id="dashboard-focus-panel">
            {productionPreviewVisible.length > 0 ? (
              productionPreviewVisible.map((order) => (
                <DashboardCleanOrderRow
                  key={order.id}
                  meta={queueConfig.renderMeta(order)}
                  order={order}
                  tone={getOrderTone(order)}
                />
              ))
            ) : (
              <div className="dashboard-clean-empty">{queueConfig.emptyMessage}</div>
            )}

            {productionPreviewOrders.length > DASHBOARD_CLEAN_VISIBLE_LIMIT ? (
              <Link className="dashboard-clean-more" href={queueConfig.viewHref}>
                Altri {productionPreviewOrders.length - DASHBOARD_CLEAN_VISIBLE_LIMIT}
              </Link>
            ) : null}
          </div>
        </article>

        <article className={`dashboard-clean-panel dashboard-clean-finance${pulseClass(activePulse, "FINANCE", "FINANCE_AGED")}`} id="dashboard-operativa">
          <div className="dashboard-clean-head">
            <strong>Fatture</strong>
            <Link href={links.financeAll} prefetch={false}>
              Apri lista
            </Link>
          </div>

          <div className={`dashboard-clean-finance-row${financePrimaryAction ? "" : " is-single"}`}>
            <Link className="dashboard-clean-finance-total" href={links.financeAll} prefetch={false}>
              <span>Totale da fatturare</span>
              <strong>{formatCurrency(totalInvoicableCents)}</strong>
              <small>{invoiceOrders.length === 1 ? "1 ordine" : `${invoiceOrders.length} ordini`}</small>
            </Link>

            {financePrimaryAction ? (
              <Link className="dashboard-clean-finance-action" href={financePrimaryAction.href} prefetch={false}>
                <span>{financePrimaryAction.label}</span>
                <strong>{financePrimaryAction.value}</strong>
              </Link>
            ) : null}
          </div>
        </article>

        {hasMaterialsSignal ? (
          <article className="dashboard-clean-panel dashboard-clean-materials" id="dashboard-materials">
            <div className="dashboard-clean-head">
              <strong>Materiali</strong>
              <Link href={links.purchaseNotes}>Apri lista</Link>
            </div>

            <div className="dashboard-clean-metrics dashboard-clean-metrics-compact">
              <DashboardCleanMetric href={links.purchaseNotes} label="Aperte" tone="ink" value={materialsOpenCount} />
              <DashboardCleanMetric
                href={materialsActionHref}
                label={materialsBlockingCount > 0 ? "Bloccanti" : "In attesa"}
                tone={materialsActionCount > 0 ? "red" : "lime"}
                value={materialsActionCount}
              />
            </div>

            <Link className="dashboard-clean-material-note" href={materialsLeadHref}>
              <span>{materialsLeadLabel}</span>
              <strong>{materialsLeadTitle}</strong>
              <small>{materialsLeadMeta}</small>
            </Link>
          </article>
        ) : null}
      </section>

      <DashboardWeeklyOverview activePulse={activePulse} selectedDayKey={selectedDay?.key} weekLoad={weekLoad} />
    </div>
  );
}

function DashboardCleanMetric({
  active = false,
  href,
  label,
  tone,
  value
}: {
  active?: boolean;
  href: string;
  label: string;
  tone: DashboardMetricTone;
  value: number | string;
}) {
  return (
    <Link aria-current={active ? "page" : undefined} className={`dashboard-clean-metric tone-${tone}${active ? " is-active" : ""}`} href={href}>
      <strong>{value}</strong>
      <span>{label}</span>
    </Link>
  );
}

function DashboardWeeklyOverview({
  activePulse,
  selectedDayKey,
  weekLoad
}: {
  activePulse: DashboardPulse | null;
  selectedDayKey?: string;
  weekLoad: DashboardWeekDayLoad[];
}) {
  return (
    <article className={`dashboard-clean-panel dashboard-clean-week${pulseClass(activePulse, "CALENDAR", "DAY")}`}>
      <div className="dashboard-clean-head">
        <strong>Settimana</strong>
        <Link href="/calendar">Calendario</Link>
      </div>

      <div className="dashboard-clean-week-days" aria-label="Carico settimana">
        {weekLoad.map((day) => (
          <DashboardWeekDayCard day={day} isActive={day.key === selectedDayKey} key={day.key} />
        ))}
      </div>
    </article>
  );
}

function DashboardWeekDayCard({ day, isActive }: { day: DashboardWeekDayLoad; isActive: boolean }) {
  const tone = getDashboardWeekTone(day);
  const filledSlots = Math.min(day.workload, 8);
  const displayWorkload = day.workload > 8 ? "8+" : String(day.workload);

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={`dashboard-clean-week-day tone-${tone}${isActive ? " is-active" : ""}`}
      href={buildDashboardWeekDayHref(day.key)}
      prefetch={false}
    >
      <span className="dashboard-clean-week-date">
        <strong>{day.shortLabel}</strong>
        <small>{day.dayLabel}</small>
      </span>

      <span className="dashboard-clean-week-count">
        <strong>{displayWorkload}</strong>
        <small>Consegne</small>
      </span>

      <span className="dashboard-clean-week-load" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <span className={index < filledSlots ? "is-filled" : undefined} key={index} />
        ))}
      </span>

      <span className="dashboard-clean-week-flags">
        {day.appointments > 0 ? <span className="dashboard-clean-week-flag tone-blue">{day.appointments} app</span> : null}
        {day.ready > 0 ? <span className="dashboard-clean-week-flag tone-cyan">{day.ready} pronti</span> : null}
        {day.blocked > 0 ? <span className="dashboard-clean-week-flag tone-red">{day.blocked} stop</span> : null}
      </span>
    </Link>
  );
}

function DashboardCleanOrderRow({
  meta,
  order,
  tone
}: {
  meta: string;
  order: DashboardOrder;
  tone: "neutral" | "danger" | "warning" | "success";
}) {
  const toneClass = tone === "danger" ? "red" : tone === "warning" ? "lime" : tone === "success" ? "cyan" : "blue";
  const contextLabel = getDashboardOrderContextLabel(meta, order);
  const shopOnlineOrderCode = getDashboardShopOnlineOrderCode(order);

  return (
    <article className={`dashboard-clean-order tone-${toneClass}${shopOnlineOrderCode ? " is-shop-online" : ""}`}>
      <Link className="dashboard-clean-order-copy" href={`/orders/${order.id}`}>
        <span className="dashboard-clean-order-code">{getDisplayOrderLabel(order.orderCode, order.title)}</span>
        <strong className="dashboard-clean-order-title">{order.customer.name}</strong>
        {shopOnlineOrderCode ? <span className="pill compact-pill shop-online-pill">Shop online</span> : null}
        {contextLabel ? <small className="dashboard-clean-order-meta">{contextLabel}</small> : null}
      </Link>

      <div className="dashboard-clean-order-side">
        <DashboardOrderDue deliveryAt={order.deliveryAt} />
        <DashboardProductionRowActions order={order} />
      </div>
    </article>
  );
}

function getDashboardShopOnlineOrderCode(order: DashboardOrder) {
  return order.salesOrderLinks?.find((link) => link.salesOrder.origin === "SHOP_ONLINE")?.salesOrder.orderCode || null;
}

function DashboardOrderDue({ deliveryAt }: { deliveryAt: DashboardOrder["deliveryAt"] }) {
  return (
    <span className="dashboard-clean-order-due">
      <small>Consegna</small>
      <strong>{getDashboardDeliveryDayLabel(deliveryAt)}</strong>
      <em>{getDashboardDeliveryTimeLabel(deliveryAt)}</em>
    </span>
  );
}

function DashboardProductionRowActions({ order }: { order: DashboardOrder }) {
  if (order.operationalStatus !== "ATTIVO") {
    return (
      <div className="dashboard-clean-order-actions">
        <span className="dashboard-clean-order-status">{operationalStatusLabels[order.operationalStatus]}</span>
      </div>
    );
  }

  if (order.mainPhase === "SVILUPPO_COMPLETATO") {
    return (
      <div className="dashboard-clean-order-actions dashboard-clean-order-actions-ready">
        <ReadyWhatsAppButton
          compact
          hasPhone={hasDashboardWhatsapp(order)}
          label="Messaggio"
          notifiedAt={order.readyWhatsappSentAt}
          orderId={order.id}
          showLabel
        />
        <DashboardPhaseButton label="Consegnato" nextPhase="CONSEGNATO" orderId={order.id} tone="ink" />
      </div>
    );
  }

  const nextAction = getDashboardProductionNextAction(order);
  if (!nextAction) {
    return (
      <div className="dashboard-clean-order-actions">
        <span className="dashboard-clean-order-status">Aprire</span>
      </div>
    );
  }

  return (
    <div className="dashboard-clean-order-actions">
      <DashboardPhaseButton label={nextAction.label} nextPhase={nextAction.nextPhase} orderId={order.id} tone={nextAction.tone} />
    </div>
  );
}

function DashboardPhaseButton({
  label,
  nextPhase,
  orderId,
  tone
}: {
  label: string;
  nextPhase: MainPhase;
  orderId: string;
  tone: "blue" | "cyan" | "ink" | "lime";
}) {
  return (
    <form action={quickUpdatePhaseAction} className="dashboard-clean-phase-form">
      <input name="orderId" type="hidden" value={orderId} />
      <input name="nextPhase" type="hidden" value={nextPhase} />
      <button className={`dashboard-clean-phase-button tone-${tone}`} type="submit">
        {label}
      </button>
    </form>
  );
}

function mergeUniqueOrders(...lists: DashboardOrder[][]) {
  const unique = new Map<string, DashboardOrder>();

  for (const list of lists) {
    for (const order of list) {
      if (!unique.has(order.id)) {
        unique.set(order.id, order);
      }
    }
  }

  return [...unique.values()];
}

function getSelectedDashboardDay(weekLoad: DashboardWeekDayLoad[], dayKey?: string) {
  if (!dayKey) {
    return null;
  }

  return weekLoad.find((day) => day.key === dayKey) || null;
}

function getOrdersForDashboardDay(orders: DashboardOrder[], date: Date) {
  return orders
    .filter((order) => isSameDashboardDay(order.deliveryAt, date) || (order.appointmentAt ? isSameDashboardDay(order.appointmentAt, date) : false))
    .sort((left, right) => {
      const leftTime = new Date(left.appointmentAt || left.deliveryAt).getTime();
      const rightTime = new Date(right.appointmentAt || right.deliveryAt).getTime();
      return leftTime - rightTime;
    });
}

function filterDashboardDayOrders(orders: DashboardOrder[], date: Date, focus: DashboardDayFocus) {
  if (focus === "WORKLOAD") {
    return orders.filter((order) => isSameDashboardDay(order.deliveryAt, date));
  }

  if (focus === "APPOINTMENTS") {
    return orders.filter((order) => order.appointmentAt && isSameDashboardDay(order.appointmentAt, date));
  }

  return orders;
}

function isSameDashboardDay(value: Date | string, target: Date) {
  return formatDateKey(new Date(value)) === formatDateKey(target);
}

function getDashboardDayOrderMeta(order: DashboardOrder, selectedDate: Date) {
  const chunks: string[] = [];

  if (order.appointmentAt && isSameDashboardDay(order.appointmentAt, selectedDate)) {
    chunks.push(`Appuntamento ${formatDateTime(order.appointmentAt)}`);
  }

  if (isSameDashboardDay(order.deliveryAt, selectedDate)) {
    chunks.push(`Consegna ${formatDateTime(order.deliveryAt)}`);
  }

  return chunks.join(" • ") || `Consegna ${formatDateTime(order.deliveryAt)}`;
}

function getDashboardOrderContextLabel(meta: string, order: DashboardOrder) {
  const statusLabel = operationalStatusLabels[order.operationalStatus];

  return meta
    .split(" • ")
    .filter((chunk) => !chunk.startsWith("Consegna ") && chunk !== statusLabel)
    .join(" • ");
}

function getDashboardDeliveryDayLabel(value: Date | string) {
  const deliveryDate = new Date(value);
  const todayKey = formatDateKey(new Date());

  if (formatDateKey(deliveryDate) === todayKey) {
    return "Oggi";
  }

  if (formatDateKey(deliveryDate) === formatDateKey(getTomorrowDashboardDate())) {
    return "Domani";
  }

  return formatCompactDate(deliveryDate);
}

function getDashboardDeliveryTimeLabel(value: Date | string) {
  return formatDateTime(value).split(",").at(-1)?.trim() || "";
}

function parseDashboardFocus(raw?: string): DashboardFocus {
  if (raw === "start") {
    return "TO_START";
  }

  if (raw === "working") {
    return "WORKING";
  }

  if (raw === "blocked") {
    return "BLOCKED";
  }

  if (raw === "ready") {
    return "READY";
  }

  if (raw === "tomorrow") {
    return "TOMORROW";
  }

  return "PRIORITY";
}

function parseDashboardDayFocus(raw?: string): DashboardDayFocus {
  if (raw === "workload") {
    return "WORKLOAD";
  }

  if (raw === "appointments") {
    return "APPOINTMENTS";
  }

  return "ALL";
}

function parseDashboardReadyMode(raw?: string): DashboardReadyMode | null {
  if (raw === "notified") {
    return "NOTIFIED";
  }

  if (raw === "to-notify") {
    return "TO_NOTIFY";
  }

  return null;
}

function getDashboardReadyMode(raw: string | undefined, toNotifyCount: number): DashboardReadyMode {
  const parsed = parseDashboardReadyMode(raw);

  if (parsed) {
    return parsed;
  }

  return toNotifyCount > 0 ? "TO_NOTIFY" : "NOTIFIED";
}

function getDashboardDayFocusEmptyMessage(focus: DashboardDayFocus) {
  if (focus === "WORKLOAD") {
    return "Nessun lavoro programmato per questo giorno.";
  }

  if (focus === "APPOINTMENTS") {
    return "Nessun appuntamento per questo giorno.";
  }

  return "Nessun ordine o appuntamento per questo giorno.";
}

function getDashboardFinanceReferenceDate(order: DashboardOrder) {
  if (order.mainPhase === "CONSEGNATO" && order.deliveredAt) {
    return new Date(order.deliveredAt);
  }

  return new Date(order.deliveryAt);
}

function getDashboardDateAgeInDays(value: Date | string, reference = new Date()) {
  const target = startOfDashboardDay(new Date(value)).getTime();
  const base = startOfDashboardDay(reference).getTime();
  return Math.max(0, Math.floor((base - target) / 86400000));
}

function startOfDashboardDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getTomorrowDashboardDate() {
  const tomorrow = startOfDashboardDay(new Date());
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

function getTomorrowDashboardOrders(orders: DashboardOrder[], tomorrowDate: Date) {
  return orders
    .filter((order) => isSameDashboardDay(order.deliveryAt, tomorrowDate))
    .sort((left, right) => {
      const leftTime = new Date(left.deliveryAt).getTime();
      const rightTime = new Date(right.deliveryAt).getTime();
      return leftTime - rightTime;
    });
}

function buildDashboardProductionHref(
  focus: DashboardFocus,
  options: {
    pulse?: DashboardPulse;
    readyMode?: DashboardReadyMode;
  } = {}
) {
  const params = new URLSearchParams();

  if (focus === "TO_START") {
    params.set("focus", "start");
  } else if (focus === "WORKING") {
    params.set("focus", "working");
  } else if (focus === "BLOCKED") {
    params.set("focus", "blocked");
  } else if (focus === "READY") {
    params.set("focus", "ready");
  } else if (focus === "TOMORROW") {
    params.set("focus", "tomorrow");
  }

  if (focus === "READY" && options.readyMode === "NOTIFIED") {
    params.set("readyMode", "notified");
  } else if (focus === "READY" && options.readyMode === "TO_NOTIFY") {
    params.set("readyMode", "to-notify");
  }

  if (options.pulse) {
    params.set("pulse", options.pulse.toLowerCase().replaceAll("_", "-"));
  }

  const query = params.toString();
  return `/${query ? `?${query}` : ""}#dashboard-focus-panel`;
}

function buildDashboardWeekDayHref(dayKey: string) {
  const params = new URLSearchParams();
  params.set("day", dayKey);
  params.set("pulse", "day");
  return `/?${params.toString()}#dashboard-focus-panel`;
}

function getDashboardWeekTone(day: DashboardWeekDayLoad): DashboardWeekTone {
  if (day.blocked > 0 || day.workload >= 7) {
    return "red";
  }

  if (day.ready > 0) {
    return "cyan";
  }

  if (day.workload >= 4) {
    return "lime";
  }

  if (day.workload > 0 || day.appointments > 0) {
    return "blue";
  }

  return "quiet";
}

function getNextUpcomingAppointment(orders: DashboardOrder[], reference = new Date()) {
  const start = startOfDashboardDay(reference).getTime();
  const end = startOfDashboardDay(reference);
  end.setDate(end.getDate() + 7);

  return (
    orders
      .filter((order) => {
        if (!order.appointmentAt) {
          return false;
        }

        const appointmentTime = new Date(order.appointmentAt).getTime();
        return appointmentTime >= start && appointmentTime < end.getTime();
      })
      .sort((left, right) => new Date(left.appointmentAt || left.deliveryAt).getTime() - new Date(right.appointmentAt || right.deliveryAt).getTime())[0] || null
  );
}

function getDashboardFeaturedPurchaseNote(notes: DashboardPurchaseNote[]) {
  return notes.find((note) => note.urgency === "BLOCCANTE") || notes[0] || null;
}

function getRecommendedDashboardFocus({
  blockedCount,
  lateStartCount,
  priorityCount,
  readyCount,
  readyToNotifyCount,
  tomorrowToStartCount,
  toStartCount
}: {
  blockedCount: number;
  lateStartCount: number;
  priorityCount: number;
  readyCount: number;
  readyToNotifyCount: number;
  tomorrowToStartCount: number;
  toStartCount: number;
}) {
  if (lateStartCount > 0) {
    return "TO_START" satisfies DashboardFocus;
  }

  if (blockedCount > 0) {
    return "BLOCKED" satisfies DashboardFocus;
  }

  if (readyToNotifyCount > 0) {
    return "READY" satisfies DashboardFocus;
  }

  if (priorityCount > 0) {
    return "PRIORITY" satisfies DashboardFocus;
  }

  if (toStartCount > 0) {
    return "TO_START" satisfies DashboardFocus;
  }

  if (tomorrowToStartCount > 0) {
    return "TOMORROW" satisfies DashboardFocus;
  }

  if (readyCount > 0) {
    return "READY" satisfies DashboardFocus;
  }

  return "PRIORITY" satisfies DashboardFocus;
}

function parseDashboardPulse(value?: string): DashboardPulse | null {
  if (value === "calendar") return "CALENDAR";
  if (value === "day") return "DAY";
  if (value === "priority") return "PRIORITY";
  if (value === "to-start") return "TO_START";
  if (value === "working") return "WORKING";
  if (value === "late-start") return "LATE_START";
  if (value === "blocked") return "BLOCKED";
  if (value === "ready") return "READY";
  if (value === "finance") return "FINANCE";
  if (value === "finance-aged") return "FINANCE_AGED";
  if (value === "tomorrow") return "TOMORROW";
  return null;
}

function pulseClass(activePulse: DashboardPulse | null, ...targets: DashboardPulse[]) {
  return activePulse && targets.includes(activePulse) ? " dashboard-pulse-target" : "";
}

function getDashboardProductionNextAction(order: DashboardOrder):
  | {
      label: string;
      nextPhase: MainPhase;
      tone: "blue" | "cyan" | "lime";
    }
  | null {
  if (order.mainPhase === "ACCETTATO") {
    return {
      label: "Avvia",
      nextPhase: "IN_LAVORAZIONE",
      tone: "lime"
    };
  }

  if (order.mainPhase === "CALENDARIZZATO" || order.mainPhase === "IN_LAVORAZIONE") {
    return {
      label: "Pronto",
      nextPhase: "SVILUPPO_COMPLETATO",
      tone: "cyan"
    };
  }

  return null;
}

function hasDashboardWhatsapp(order: DashboardOrder) {
  return Boolean((order.customer.whatsapp || order.customer.phone || "").replace(/[^\d+]/g, ""));
}

function getOrderTone(order: DashboardOrder) {
  const isOverdue = new Date(order.deliveryAt).getTime() < Date.now() && order.mainPhase !== "CONSEGNATO";

  if (order.operationalStatus !== "ATTIVO") {
    return "danger";
  }

  if (order.mainPhase === "SVILUPPO_COMPLETATO") {
    return "success";
  }

  if (isOverdue || order.priority === "URGENTE") {
    return "danger";
  }

  if (order.mainPhase === "ACCETTATO") {
    return "warning";
  }

  return "neutral";
}
