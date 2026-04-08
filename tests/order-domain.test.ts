import { describe, expect, it } from "vitest";
import { mainPhaseLabels } from "../lib/constants";
import {
  assertPhaseTransition,
  buildOrderCode,
  buildSalesStatsReport,
  classifyProductionQueues,
  countUniqueOrders,
  computeBalanceDue,
  computeOrderTotals,
  computePaymentSummary,
  computePaymentStatus,
  getMonthlyAgendaOrders,
  isOperationalOrder,
  normalizeServiceCode,
  normalizeOrderTitle,
  normalizeForUniqueness
} from "../lib/orders";
import { parsePhaseFilter } from "../lib/order-filters";
import { getSelectablePhaseTargets } from "../lib/order-phase-transitions";
import { getTieredUnitPrice, normalizeQuantityTiers, parseQuantityTiers } from "../lib/pricing";

describe("order domain", () => {
  it("builds order code with date and normalized title", () => {
    const code = buildOrderCode(new Date("2026-03-14T10:00:00.000Z"), "  Biglietti   visita Rossi ");
    expect(code).toBe("2026-03-14_Biglietti visita Rossi");
  });

  it("normalizes title for uniqueness", () => {
    expect(normalizeOrderTitle("  Adesivi   vetrina  ")).toBe("Adesivi vetrina");
    expect(normalizeForUniqueness("  Adesivi   vetrina  ")).toBe("adesivi vetrina");
  });

  it("computes remaining balance", () => {
    expect(computeBalanceDue(5000, 2000)).toBe(3000);
    expect(computeBalanceDue(5000, 6000)).toBe(0);
  });

  it("distinguishes acconto and partial payments", () => {
    expect(computePaymentStatus(5000, 0, 0)).toBe("NON_PAGATO");
    expect(computePaymentStatus(5000, 2000, 1)).toBe("ACCONTO");
    expect(computePaymentStatus(5000, 3500, 2)).toBe("PARZIALE");
    expect(computePaymentStatus(5000, 5000, 2)).toBe("PAGATO");
  });

  it("recomputes payment summary from active payments only", () => {
    const summary = computePaymentSummary(5000, [
      {
        id: "payment-1",
        amountCents: 2000,
        status: "SOSTITUITO",
        createdAt: new Date("2026-03-25T08:00:00.000Z")
      },
      {
        id: "payment-2",
        amountCents: 1500,
        status: "ATTIVO",
        createdAt: new Date("2026-03-25T08:00:00.000Z")
      },
      {
        id: "payment-3",
        amountCents: 2000,
        status: "ATTIVO",
        createdAt: new Date("2026-03-26T08:00:00.000Z")
      }
    ]);

    expect(summary.depositCents).toBe(1500);
    expect(summary.paidCents).toBe(3500);
    expect(summary.balanceDueCents).toBe(1500);
    expect(summary.paymentStatus).toBe("PARZIALE");
  });

  it("blocks direct jumps across phases", () => {
    expect(() => assertPhaseTransition("ACCETTATO", "SVILUPPO_COMPLETATO", 0)).toThrow(/procedi in sequenza/i);
  });

  it("blocks delivery with open balance without note", () => {
    expect(() => assertPhaseTransition("SVILUPPO_COMPLETATO", "CONSEGNATO", 1200)).toThrow(/nota di override/i);
  });

  it("allows delivery with override note", () => {
    expect(() => assertPhaseTransition("SVILUPPO_COMPLETATO", "CONSEGNATO", 1200, "Cliente paga domani")).not.toThrow();
  });

  it("keeps legacy calendarizzato hidden but compatible", () => {
    expect(getSelectablePhaseTargets("CALENDARIZZATO")).toEqual([
      "ACCETTATO",
      "IN_LAVORAZIONE",
      "SVILUPPO_COMPLETATO"
    ]);
  });

  it("normalizes legacy phase filters and user-facing labels", () => {
    expect(parsePhaseFilter("CALENDARIZZATO")).toBe("IN_LAVORAZIONE");
    expect(mainPhaseLabels.ACCETTATO).toBe("Da avviare");
    expect(mainPhaseLabels.IN_LAVORAZIONE).toBe("In lavorazione");
  });

  it("excludes preventivi from operational flows", () => {
    expect(isOperationalOrder({ isQuote: false })).toBe(true);
    expect(isOperationalOrder({ isQuote: true })).toBe(false);
  });

  it("counts unique orders across dashboard lanes", () => {
    expect(
      countUniqueOrders(
        [{ id: "order-1" }, { id: "order-2" }],
        [{ id: "order-2" }, { id: "order-3" }],
        [{ id: "order-3" }, { id: "order-4" }]
      )
    ).toBe(4);
  });

  it("classifies production queues with mutual exclusivity", () => {
    const queues = classifyProductionQueues([
      { id: "quote", isQuote: true, mainPhase: "ACCETTATO", operationalStatus: "ATTIVO" },
      { id: "accepted", isQuote: false, mainPhase: "ACCETTATO", operationalStatus: "ATTIVO" },
      { id: "scheduled", isQuote: false, mainPhase: "CALENDARIZZATO", operationalStatus: "ATTIVO" },
      { id: "working", isQuote: false, mainPhase: "IN_LAVORAZIONE", operationalStatus: "ATTIVO" },
      { id: "ready", isQuote: false, mainPhase: "SVILUPPO_COMPLETATO", operationalStatus: "ATTIVO" },
      { id: "blocked-ready", isQuote: false, mainPhase: "SVILUPPO_COMPLETATO", operationalStatus: "IN_ATTESA_FILE" }
    ]);

    expect(queues.planning.map((order) => order.id)).toEqual(["accepted"]);
    expect(queues.working.map((order) => order.id)).toEqual(["scheduled", "working"]);
    expect(queues.ready.map((order) => order.id)).toEqual(["ready"]);
    expect(queues.blocked.map((order) => order.id)).toEqual(["blocked-ready"]);
  });

  it("filters monthly agenda on appointment date only", () => {
    const agenda = getMonthlyAgendaOrders([
      {
        id: "appointment",
        isQuote: false,
        mainPhase: "IN_LAVORAZIONE",
        appointmentAt: new Date("2026-03-28T09:00:00.000Z")
      },
      {
        id: "no-appointment",
        isQuote: false,
        mainPhase: "ACCETTATO",
        appointmentAt: null
      },
      {
        id: "quote",
        isQuote: true,
        mainPhase: "IN_LAVORAZIONE",
        appointmentAt: new Date("2026-03-29T09:00:00.000Z")
      },
      {
        id: "delivered",
        isQuote: false,
        mainPhase: "CONSEGNATO",
        appointmentAt: new Date("2026-03-30T09:00:00.000Z")
      }
    ]);

    expect(agenda.map((order) => order.id)).toEqual(["appointment"]);
  });

  it("computes order totals with amount and percent discounts", () => {
    const totals = computeOrderTotals([
      {
        label: "Biglietti visita",
        quantity: 2,
        catalogBasePriceCents: 2500,
        discountMode: "AMOUNT",
        discountValue: 500,
        unitPriceCents: 2500
      },
      {
        label: "Adesivi vetrina",
        quantity: 1,
        catalogBasePriceCents: 10000,
        discountMode: "PERCENT",
        discountValue: 10,
        unitPriceCents: 10000
      }
    ]);

    expect(totals.items[0].unitPriceCents).toBe(2000);
    expect(totals.items[0].lineTotalCents).toBe(4000);
    expect(totals.items[1].unitPriceCents).toBe(9000);
    expect(totals.items[1].lineTotalCents).toBe(9000);
    expect(totals.totalCents).toBe(13000);
  });

  it("normalizes catalog codes for sync and manual entry", () => {
    expect(normalizeServiceCode("Biglietti visita premium")).toBe("BIGLIETTI_VISITA_PREMIUM");
    expect(normalizeServiceCode("Installazione / Vetrina")).toBe("INSTALLAZIONE_VETRINA");
  });

  it("builds sales stats excluding quotes and aggregating catalog and free rows", () => {
    const stats = buildSalesStatsReport(
      [
        {
          id: "order-jan",
          isQuote: false,
          createdAt: new Date("2026-01-10T10:00:00.000Z"),
          totalCents: 4000,
          items: [
            {
              label: "Manifesti A3",
              quantity: 4,
              lineTotalCents: 4000,
              serviceCatalogId: "service-a",
              serviceCatalog: { code: "MANIFESTI_A3", name: "Manifesti A3" }
            }
          ]
        },
        {
          id: "order-feb",
          isQuote: false,
          createdAt: new Date("2026-02-11T10:00:00.000Z"),
          totalCents: 6000,
          items: [
            {
              label: "Manifesti A3",
              quantity: 1,
              lineTotalCents: 1000,
              serviceCatalogId: "service-a",
              serviceCatalog: { code: "MANIFESTI_A3", name: "Manifesti A3" }
            },
            {
              label: "Montaggio   insegna",
              quantity: 1,
              lineTotalCents: 5000
            }
          ]
        },
        {
          id: "quote-mar",
          isQuote: true,
          createdAt: new Date("2026-03-02T10:00:00.000Z"),
          totalCents: 10000,
          items: [
            {
              label: "Preventivo speciale",
              quantity: 1,
              lineTotalCents: 10000
            }
          ]
        },
        {
          id: "order-mar",
          isQuote: false,
          createdAt: new Date("2026-03-12T10:00:00.000Z"),
          totalCents: 4000,
          items: [
            {
              label: "Montaggio insegna",
              quantity: 1,
              lineTotalCents: 4000
            }
          ]
        }
      ],
      { referenceDate: new Date("2026-03-25T10:00:00.000Z") }
    );

    expect(stats.summaryCurrentMonth.monthKey).toBe("2026-03");
    expect(stats.summaryCurrentMonth.revenueCents).toBe(4000);
    expect(stats.summaryCurrentMonth.ordersCount).toBe(1);
    expect(stats.summaryCurrentMonth.trend).toBe("down");
    expect(stats.monthlyTrend).toHaveLength(12);
    expect(stats.monthlyTrend.find((month) => month.monthKey === "2025-12")?.revenueCents).toBe(0);
    expect(stats.monthlyTrend.find((month) => month.monthKey === "2026-01")?.trend).toBe("new");

    expect(stats.topByRevenue[0]).toMatchObject({
      label: "Montaggio insegna",
      revenueCents: 9000,
      quantity: 2,
      orderCount: 2
    });
    expect(stats.topByQuantity[0]).toMatchObject({
      label: "Manifesti A3",
      revenueCents: 5000,
      quantity: 5,
      orderCount: 2,
      catalogCode: "MANIFESTI_A3"
    });
  });

  it("parses quantity tiers and applies decimal tier prices", () => {
    const raw = "1-9:0,50 | 10-49:0,30 | 50+:0,20";
    const tiers = parseQuantityTiers(raw);

    expect(tiers).toEqual([
      { minQuantity: 1, maxQuantity: 9, unitPriceCents: 50 },
      { minQuantity: 10, maxQuantity: 49, unitPriceCents: 30 },
      { minQuantity: 50, maxQuantity: null, unitPriceCents: 20 }
    ]);

    expect(normalizeQuantityTiers(raw)).toBe("1-9:0,50 | 10-49:0,30 | 50+:0,20");
    expect(getTieredUnitPrice(100, 5, raw)).toBe(50);
    expect(getTieredUnitPrice(100, 20, raw)).toBe(30);
    expect(getTieredUnitPrice(100, 120, raw)).toBe(20);
  });
});
