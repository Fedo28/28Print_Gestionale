import { describe, expect, it } from "vitest";
import { rankBillboardAssets } from "../lib/billboard-asset-search";
import {
  bookingIncludesDate,
  buildBillboardAssetSeed,
  calculateBillboardBookingBalanceCents,
  rangesOverlap,
  reservesBillboardAsset
} from "../lib/billboards";

describe("billboards domain", () => {
  it("builds the default billboard inventory seed", () => {
    const assets = buildBillboardAssetSeed();

    expect(assets).toHaveLength(26);
    expect(assets[0]).toMatchObject({
      code: "CARTELLONE_01",
      name: "Cartellone 01",
      kind: "CARTELLONE",
      sortOrder: 1,
      active: true,
      location: null
    });
    expect(assets[23]).toMatchObject({
      code: "CARTELLONE_24",
      name: "Cartellone 24",
      kind: "CARTELLONE",
      sortOrder: 24
    });
    expect(assets[24]).toMatchObject({
      code: "MONITOR_01",
      name: "Monitor",
      kind: "MONITOR",
      sortOrder: 25
    });
    expect(assets[25]).toMatchObject({
      code: "VELA_01",
      name: "Vela itinerante",
      kind: "VELA_ITINERANTE",
      sortOrder: 26
    });
  });

  it("detects overlapping billboard ranges inclusively", () => {
    expect(
      rangesOverlap(
        new Date("2026-04-10T12:00:00"),
        new Date("2026-04-15T12:00:00"),
        new Date("2026-04-15T12:00:00"),
        new Date("2026-04-20T12:00:00")
      )
    ).toBe(true);

    expect(
      rangesOverlap(
        new Date("2026-04-10T12:00:00"),
        new Date("2026-04-14T12:00:00"),
        new Date("2026-04-15T12:00:00"),
        new Date("2026-04-20T12:00:00")
      )
    ).toBe(false);
  });

  it("understands if a booking covers a specific day", () => {
    const booking = {
      startsAt: new Date("2026-04-10T12:00:00"),
      endsAt: new Date("2026-04-15T12:00:00")
    };

    expect(bookingIncludesDate(booking, new Date("2026-04-10T09:00:00"))).toBe(true);
    expect(bookingIncludesDate(booking, new Date("2026-04-15T18:00:00"))).toBe(true);
    expect(bookingIncludesDate(booking, new Date("2026-04-16T09:00:00"))).toBe(false);
  });

  it("calculates billboard balance without going below zero", () => {
    expect(calculateBillboardBookingBalanceCents(25000, 10000)).toBe(15000);
    expect(calculateBillboardBookingBalanceCents(25000, 26000)).toBe(0);
  });

  it("keeps assets reserved only for active billboard statuses", () => {
    expect(reservesBillboardAsset("CONFERMATO")).toBe(true);
    expect(reservesBillboardAsset("OPZIONATO")).toBe(true);
    expect(reservesBillboardAsset("SCADUTO")).toBe(false);
  });

  it("ranks billboard assets by name before code and location", () => {
    const rankedByName = rankBillboardAssets(
      [
        {
          id: "1",
          code: "CARTELLONE_12",
          name: "Cartellone 12",
          kind: "CARTELLONE",
          location: "Via Roma"
        },
        {
          id: "2",
          code: "MONITOR_01",
          name: "Monitor",
          kind: "MONITOR",
          location: "Centro"
        },
        {
          id: "3",
          code: "VELA_01",
          name: "Vela itinerante",
          kind: "VELA_ITINERANTE",
          location: "Via Roma"
        }
      ],
      "cartellone"
    );

    expect(rankedByName.map((asset) => asset.id)).toEqual(["1"]);

    const rankedByLocation = rankBillboardAssets(
      [
        {
          id: "1",
          code: "CARTELLONE_12",
          name: "Cartellone 12",
          kind: "CARTELLONE",
          location: "Via Roma"
        },
        {
          id: "2",
          code: "MONITOR_01",
          name: "Monitor",
          kind: "MONITOR",
          location: "Centro"
        },
        {
          id: "3",
          code: "VELA_01",
          name: "Vela itinerante",
          kind: "VELA_ITINERANTE",
          location: "Via Roma"
        }
      ],
      "via roma"
    );

    expect(rankedByLocation.map((asset) => asset.id)).toEqual(["1", "3"]);
  });
});
