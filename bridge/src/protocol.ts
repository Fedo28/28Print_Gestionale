export const PROFILE = "A4_BW_SIMPLEX_1_HOLD_V1";
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export type PrintManifest = {
  id: string;
  claimToken: string;
  sha256: string;
  fileSize: number;
  destinationKey: string;
  profileKey: string;
};
export type Report = {
  jobId: string;
  claimToken: string;
  dispatchId?: string;
  outcome: "DELIVERED" | "ERROR" | "NEEDS_REVIEW";
  detail: string;
};
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function validateManifest(raw: unknown): PrintManifest {
  const job = raw as PrintManifest;
  if (!job || !isUuid(job.id) || !isUuid(job.claimToken) || !/^[a-f0-9]{64}$/.test(job.sha256) ||
    !Number.isInteger(job.fileSize) || job.fileSize <= 0 || job.fileSize > MAX_PDF_BYTES ||
    !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(job.destinationKey) || job.profileKey !== PROFILE) {
    throw new Error("Manifest lavoro non valido o profilo non supportato.");
  }
  return job;
}
