import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvConfig(projectRoot);

const prisma = new PrismaClient();
const defaultRunDir = "/private/tmp/merge-clienti-20260723";

function getArgument(name: string, fallback: string) {
  const inlinePrefix = `${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(inlinePrefix));
  if (inline) return inline.slice(inlinePrefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const sourcePath = getArgument("--source", path.join(defaultRunDir, "customer-import-source.json"));
const importPlanPath = getArgument("--import-plan", path.join(defaultRunDir, "customer-import-plan.json"));
const syncPlanPath = getArgument("--sync-plan", path.join(defaultRunDir, "customer-name-sync-plan.json"));
const resultPath = getArgument("--result", path.join(defaultRunDir, "customer-name-sync-result.json"));
const commit = process.argv.includes("--commit");
const verify = process.argv.includes("--verify");

type SourceRecord = {
  sourceRow: number;
  vatNumberNormalized: string;
  taxCodeNormalized: string;
  values: Record<string, string>;
};

type SourceFile = {
  records: SourceRecord[];
};

type ImportPlan = {
  existingMatches: Array<{
    sourceRow: number;
    reasons: string[];
  }>;
};

type PlannedUpdate = {
  sourceRow: number;
  customerId: string;
  vatNumber: string;
  taxCode: string | null;
  previousName: string;
  nextName: string;
  ordersBefore: number;
};

type SyncPlan = {
  generatedAt: string;
  importMatches: number;
  vatMatches: number;
  updates: PlannedUpdate[];
  alreadyUpToDate: Array<{ sourceRow: number; customerId: string; vatNumber: string; name: string }>;
  skipped: Array<{ sourceRow: number; vatNumber: string; reason: string }>;
};

type SyncResult = {
  committedAt: string;
  updated: PlannedUpdate[];
  skippedAtCommit: Array<{ customerId: string; reason: string }>;
};

function normalizeIdentifier(value: string | null | undefined, numericLength = 0) {
  const compact = String(value ?? "").trim().toUpperCase().replace(/^IT(?=\d)/, "").replace(/[^A-Z0-9]/g, "");
  if (numericLength && /^\d+$/.test(compact) && compact.length < numericLength) {
    return compact.padStart(numericLength, "0");
  }
  return compact;
}

function cleanName(record: SourceRecord) {
  const value = String(record.values.Denominazione || [record.values.Nome, record.values.Cognome].filter(Boolean).join(" "))
    .replace(/\s+/g, " ")
    .trim();
  const quoteCount = (value.match(/"/g) || []).length;
  return value.startsWith('"') && quoteCount === 1 ? value.slice(1).trim() : value;
}

async function readJson<T>(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
}

async function buildPlan(): Promise<SyncPlan> {
  const [source, importPlan, customers] = await Promise.all([
    readJson<SourceFile>(sourcePath),
    readJson<ImportPlan>(importPlanPath),
    prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        vatNumber: true,
        taxCode: true,
        _count: { select: { orders: true } },
      },
    }),
  ]);
  const sourceByRow = new Map(source.records.map((record) => [record.sourceRow, record]));
  const customersByVat = new Map<string, typeof customers>();
  for (const customer of customers) {
    const vat = normalizeIdentifier(customer.vatNumber, 11);
    if (!vat) continue;
    const current = customersByVat.get(vat) || [];
    current.push(customer);
    customersByVat.set(vat, current);
  }

  const vatMatches = importPlan.existingMatches.filter((match) => match.reasons.includes("P.IVA"));
  const updates: PlannedUpdate[] = [];
  const alreadyUpToDate: SyncPlan["alreadyUpToDate"] = [];
  const skipped: SyncPlan["skipped"] = [];
  const seenVat = new Set<string>();

  for (const match of vatMatches) {
    const record = sourceByRow.get(match.sourceRow);
    if (!record || !record.vatNumberNormalized) {
      skipped.push({ sourceRow: match.sourceRow, vatNumber: "", reason: "Record sorgente o P.IVA mancante." });
      continue;
    }
    if (seenVat.has(record.vatNumberNormalized)) {
      skipped.push({ sourceRow: match.sourceRow, vatNumber: record.vatNumberNormalized, reason: "P.IVA ripetuta nel piano di importazione." });
      continue;
    }
    seenVat.add(record.vatNumberNormalized);
    const matches = customersByVat.get(record.vatNumberNormalized) || [];
    if (matches.length !== 1) {
      skipped.push({
        sourceRow: match.sourceRow,
        vatNumber: record.vatNumberNormalized,
        reason: matches.length ? "P.IVA associata a piu clienti nel gestionale." : "Cliente con P.IVA non trovato nel gestionale.",
      });
      continue;
    }

    const customer = matches[0];
    const nextName = cleanName(record);
    if (!nextName) {
      skipped.push({ sourceRow: match.sourceRow, vatNumber: record.vatNumberNormalized, reason: "Nuovo nome non disponibile nel file Excel." });
      continue;
    }
    if (customer.name.replace(/\s+/g, " ").trim() === nextName) {
      alreadyUpToDate.push({ sourceRow: match.sourceRow, customerId: customer.id, vatNumber: record.vatNumberNormalized, name: customer.name });
      continue;
    }
    updates.push({
      sourceRow: match.sourceRow,
      customerId: customer.id,
      vatNumber: record.vatNumberNormalized,
      taxCode: customer.taxCode,
      previousName: customer.name,
      nextName,
      ordersBefore: customer._count.orders,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    importMatches: importPlan.existingMatches.length,
    vatMatches: vatMatches.length,
    updates,
    alreadyUpToDate,
    skipped,
  };
}

async function commitUpdates(plan: SyncPlan): Promise<SyncResult> {
  const updated: PlannedUpdate[] = [];
  const skippedAtCommit: SyncResult["skippedAtCommit"] = [];

  await prisma.$transaction(async (tx) => {
    for (const entry of plan.updates) {
      const customer = await tx.customer.findUnique({
        where: { id: entry.customerId },
        select: { id: true, name: true, vatNumber: true, taxCode: true, _count: { select: { orders: true } } },
      });
      if (!customer) {
        skippedAtCommit.push({ customerId: entry.customerId, reason: "Cliente non piu disponibile." });
        continue;
      }
      if (normalizeIdentifier(customer.vatNumber, 11) !== entry.vatNumber) {
        skippedAtCommit.push({ customerId: entry.customerId, reason: "P.IVA modificata dopo il piano." });
        continue;
      }
      if (customer.name.replace(/\s+/g, " ").trim() !== entry.previousName) {
        skippedAtCommit.push({ customerId: entry.customerId, reason: "Nome modificato dopo il piano." });
        continue;
      }

      const next = await tx.customer.update({
        where: { id: customer.id },
        data: { name: entry.nextName },
        select: { id: true, name: true, vatNumber: true, taxCode: true, _count: { select: { orders: true } } },
      });
      await tx.auditLog.create({
        data: {
          entityType: "CUSTOMER",
          entityId: next.id,
          entityLabel: next.name,
          actionType: "UPDATED",
          title: "Ragione sociale aggiornata da import Excel",
          details: `${entry.previousName} -> ${next.name}`,
          snapshotBefore: {
            id: customer.id,
            name: customer.name,
            vatNumber: customer.vatNumber,
            taxCode: customer.taxCode,
            orderCount: customer._count.orders,
          } as Prisma.InputJsonValue,
          snapshotAfter: {
            id: next.id,
            name: next.name,
            vatNumber: next.vatNumber,
            taxCode: next.taxCode,
            orderCount: next._count.orders,
          } as Prisma.InputJsonValue,
        },
      });
      updated.push(entry);
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 10_000,
    timeout: 120_000,
  });

  return { committedAt: new Date().toISOString(), updated, skippedAtCommit };
}

async function verifyUpdates(plan: SyncPlan, result: SyncResult) {
  const customerIds = result.updated.map((entry) => entry.customerId);
  const [customers, auditCount] = await Promise.all([
    prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, vatNumber: true, _count: { select: { orders: true } } },
    }),
    prisma.auditLog.count({
      where: {
        entityType: "CUSTOMER",
        entityId: { in: customerIds },
        actionType: "UPDATED",
        title: "Ragione sociale aggiornata da import Excel",
      },
    }),
  ]);
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const issues: string[] = [];
  for (const entry of result.updated) {
    const customer = customerById.get(entry.customerId);
    if (!customer) {
      issues.push(`${entry.customerId}: cliente non trovato dopo l'aggiornamento.`);
      continue;
    }
    if (customer.name !== entry.nextName) issues.push(`${entry.customerId}: nome non aggiornato.`);
    if (normalizeIdentifier(customer.vatNumber, 11) !== entry.vatNumber) issues.push(`${entry.customerId}: P.IVA modificata.`);
    if (customer._count.orders !== entry.ordersBefore) issues.push(`${entry.customerId}: numero ordini modificato.`);
  }
  if (auditCount !== result.updated.length) issues.push("Numero registri attivita non coerente.");
  if (issues.length) throw new Error(issues.join("\n"));

  return {
    plannedUpdates: plan.updates.length,
    updatedCustomers: result.updated.length,
    alreadyUpToDate: plan.alreadyUpToDate.length,
    skipped: plan.skipped.length + result.skippedAtCommit.length,
    auditLogs: auditCount,
    preservedOrders: true,
  };
}

async function main() {
  if (verify) {
    const [plan, result] = await Promise.all([
      readJson<SyncPlan>(syncPlanPath),
      readJson<SyncResult>(resultPath),
    ]);
    console.log(JSON.stringify({ mode: "verify", ...(await verifyUpdates(plan, result)) }, null, 2));
    return;
  }

  const plan = await buildPlan();
  await fs.writeFile(syncPlanPath, JSON.stringify(plan, null, 2));
  if (!commit) {
    console.log(JSON.stringify({
      mode: "dry-run",
      importMatches: plan.importMatches,
      vatMatches: plan.vatMatches,
      updates: plan.updates.length,
      alreadyUpToDate: plan.alreadyUpToDate.length,
      skipped: plan.skipped.length,
      syncPlanPath,
    }, null, 2));
    return;
  }

  const result = await commitUpdates(plan);
  await fs.writeFile(resultPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({
    mode: "commit",
    updated: result.updated.length,
    skippedAtCommit: result.skippedAtCommit.length,
    resultPath,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
