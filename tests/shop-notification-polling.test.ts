import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ session: vi.fn(), revision: vi.fn(), list: vi.fn(), mark: vi.fn() }));
vi.mock("../lib/auth-core", () => ({ readSession: mocks.session }));
vi.mock("../lib/shop-notification-inbox", () => ({
  getShopNotificationRevision: mocks.revision, listUnreadShopSalesOrderNotifications: mocks.list,
  markShopSalesOrderNotificationRead: mocks.mark
}));
import { GET } from "../app/api/orders/shop-online/pending/route";

beforeEach(() => { vi.resetAllMocks(); mocks.session.mockReturnValue({ userId: "staff" }); mocks.revision.mockResolvedValue('"rev-a"'); });
describe("conditional authenticated notification polling", () => {
  it("rejects anonymous requests before querying the database", async () => {
    mocks.session.mockReturnValue(null);
    expect((await GET(new NextRequest("https://test.invalid/api/orders/shop-online/pending"))).status).toBe(401);
    expect(mocks.revision).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("does not load notification payloads when unchanged", async () => {
    const response = await GET(new NextRequest("https://test.invalid/api/orders/shop-online/pending", { headers: { "If-None-Match": '"rev-a"' } }));
    expect(response.status).toBe(304);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("returns new content and validator after a change or on first load", async () => {
    mocks.list.mockResolvedValue({ count: 1, orders: [{ id: "new" }] });
    const response = await GET(new NextRequest("https://test.invalid/api/orders/shop-online/pending", { headers: { "If-None-Match": '"old"' } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ count: 1, orders: [{ id: "new" }] });
    expect(response.headers.get("etag")).toBe('"rev-a"');
    expect(mocks.list).toHaveBeenCalledOnce();
  });
});
