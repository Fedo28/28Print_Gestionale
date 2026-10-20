import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), approve: vi.fn(), review: vi.fn(), destinations: vi.fn(), latest: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/lib/print-jobs", () => ({ approvePrint: mocks.approve, reviewPrintAttachment: mocks.review }));
vi.mock("@/lib/prisma", () => ({ prisma: { printDestination: { findMany: mocks.destinations }, printJob: { findFirst: mocks.latest } } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { approveAttachmentQuick, reviewAttachmentQuick } from "../app/orders/[id]/fiery/quick-actions";
import { GET as previewPdf } from "../app/api/orders/[id]/print-preview/route";
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ userId: "admin" }); });
describe("Quick print server actions", () => {
  it("serves only the reviewed hash through the authenticated preview route", async () => {
    mocks.review.mockResolvedValue({ sha256: "hash", bytes: Buffer.from("%PDF-synthetic") });
    const wrong = await previewPdf(new Request("https://test.invalid/api/orders/order/print-preview?attachment=a&sha256=old"), { params: { id: "order" } });
    expect(wrong.status).toBe(409);
    const correct = await previewPdf(new Request("https://test.invalid/api/orders/order/print-preview?attachment=a&sha256=hash"), { params: { id: "order" } });
    expect(correct.status).toBe(200); expect(correct.headers.get("cache-control")).toContain("no-store");
    expect(correct.headers.get("content-type")).toBe("application/pdf"); expect(await correct.text()).toBe("%PDF-synthetic");
    expect(mocks.review).toHaveBeenCalledWith("admin", "order", "a");
  });
  it("does not expose PDF bytes if the admin/source authorization rejects", async () => {
    mocks.review.mockRejectedValue(Error("Unauthorized"));
    expect((await previewPdf(new Request("https://test.invalid/api/orders/o/print-preview"), { params: { id: "o" } })).status).toBe(403);
  });
  it("review is read-only and does not serialize file bytes", async () => {
    mocks.review.mockResolvedValue({ attachment: { fileName: "test.pdf", filePath: "https://test.invalid/file.pdf" }, bytes: Buffer.from("private"), sha256: "hash", pageCount: 1 });
    mocks.destinations.mockResolvedValue([]); mocks.latest.mockResolvedValue(null);
    const result = await reviewAttachmentQuick("order", "attachment");
    expect(result.ok).toBe(true); expect(JSON.stringify(result)).not.toContain("private"); expect(mocks.approve).not.toHaveBeenCalled();
    expect(mocks.review).toHaveBeenCalledWith("admin", "order", "attachment");
  });
  it("requires explicit approval and reuses the existing idempotent service", async () => {
    const input = { orderId: "order", attachmentId: "attachment", destinationId: "destination", sha256: "hash", confirmed: false };
    expect((await approveAttachmentQuick(input)).ok).toBe(false); expect(mocks.approve).not.toHaveBeenCalled();
    mocks.approve.mockResolvedValue("job");
    expect(await approveAttachmentQuick({ ...input, confirmed: true })).toEqual({ ok: true, jobId: "job" });
    expect(mocks.approve).toHaveBeenCalledWith(expect.objectContaining({ userId: "admin", sha256: "hash", destinationId: "destination" }));
  });
  it("returns domain errors without hiding rejection or exposing database internals", async () => {
    mocks.review.mockRejectedValue(Error("Solo un amministratore attivo"));
    expect(await reviewAttachmentQuick("o", "a")).toMatchObject({ ok: false, error: "Solo un amministratore attivo" });
    const error = Error("postgresql://secret"); error.name = "PrismaClientKnownRequestError"; mocks.review.mockRejectedValue(error);
    expect(JSON.stringify(await reviewAttachmentQuick("o", "a"))).not.toContain("secret");
  });
});
