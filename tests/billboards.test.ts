import { describe, expect, it } from "vitest";
import { rankBillboardAssets } from "../lib/billboard-asset-search";
import {
  DEFAULT_BILLBOARD_ASSET_DEFINITIONS,
  bookingIncludesDate,
  buildBillboardAssetSeed,
  calculateBillboardBookingBalanceCents,
  rangesOverlap,
  reservesBillboardAsset
} from "../lib/billboards";

describe("billboards domain", () => {
  it("builds the default billboard inventory seed", () => {
    const assets = buildBillboardAssetSeed();

    expect(assets).toHaveLength(DEFAULT_BILLBOARD_ASSET_DEFINITIONS.length);
    expect(assets).toEqual(
      DEFAULT_BILLBOARD_ASSET_DEFINITIONS.map((asset) => ({
        code: asset.code,
        name: asset.name,
        kind: asset.kind,
        location: asset.location,
        sortOrder: asset.sortOrder,
        active: true
      }))
    );
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
