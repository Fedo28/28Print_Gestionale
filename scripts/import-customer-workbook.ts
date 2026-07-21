import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvConfig(projectRoot);

const prisma = new PrismaClient();
const sourcePath = "/private/tmp/merge-clienti-019f846b/customer-import-source.json";
const planPath = "/private/tmp/merge-clienti-019f846b/customer-import-plan.json";
const resultPath = "/private/tmp/merge-clienti-019f846b/customer-import-result.json";
const commit = process.argv.includes("--commit");
const verify = process.argv.includes("--verify");

type SourceRecord = {
  sourceRow: number;
  vatNumberNormalized: string;
  taxCodeNormalized: string;
  values: Record<string, string>;
};

type SourceFile = {
  workbookPath: string;
  headers: string[];
  records: SourceRecord[];
};

function normalizeIdentifier(value: string | null | undefined, numericLength = 0) {
  const compact = String(value ?? "").trim().toUpperCase().replace(/^IT(?=\d)/, "").replace(/[^A-Z0-9]/g, "");
  if (numericLength && /^\d+$/.test(compact) && compact.length < numericLength) {
    return compact.padStart(numericLength, "0");
  }
  return compact;
}

function optional(value: string | null | undefined) {
  return String(value ?? "").trim() || undefined;
}

function cleanCustomerName(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  const quoteCount = (compact.match(/"/g) || []).length;
  return compact.startsWith('"') && quoteCount === 1 ? compact.slice(1).trim() : compact;
}

function buildCustomerData(record: SourceRecord): Prisma.CustomerCreateInput {
  const values = record.values;
  const telematicAddress = optional(values["Indirizzo telematico"]);
  const telematicIsEmail = Boolean(telematicAddress?.includes("@"));
  const pec = optional(values.PEC) || (telematicIsEmail ? telematicAddress : undefined);
  const uniqueCode = telematicAddress && !telematicIsEmail ? telematicAddress : undefined;
  const address = [optional(values.Indirizzo), optional(values["Numero civico"])].filter(Boolean).join(" ");
  const city = [optional(values.CAP), optional(values.Comune)].filter(Boolean).join(" ");
  const province = optional(values.Provincia);
  const country = optional(values.Nazione) || optional(values["ID Paese"]);
  const location = [address, city, province ? `(${province})` : undefined, country].filter(Boolean).join(", ");
  const notes = [
    location ? `Sede: ${location}` : undefined,
    telematicIsEmail && pec && telematicAddress?.toLowerCase() !== pec.toLowerCase()
      ? `Indirizzo telematico fatturazione: ${telematicAddress}`
      : undefined,
    optional(values["Codice EORI"]) ? `Codice EORI: ${values["Codice EORI"].trim()}` : undefined,
    optional(values.Beneficiario) ? `Beneficiario: ${values.Beneficiario.trim()}` : undefined,
    optional(values["Condizioni di pagamento"])
      ? `Condizioni di pagamento: ${values["Condizioni di pagamento"].trim()}`
      : undefined,
    optional(values["Metodo di pagamento"])
      ? `Metodo di pagamento: ${values["Metodo di pagamento"].trim()}`
      : undefined,
    optional(values.Banca) ? `Banca: ${values.Banca.trim()}` : undefined,
  ].filter(Boolean).join("\n");

  const name = cleanCustomerName(optional(values.Denominazione)
    || [optional(values.Nome), optional(values.Cognome)].filter(Boolean).join(" ")
    || `Cliente importato riga ${record.sourceRow}`);
  const sourceType = String(values["Tipo Cliente"] || "").trim().toUpperCase();

  return {
    name,
    type: sourceType === "B2C" ? "PUBBLICO" : "AZIENDA",
    phone: optional(values.Telefono),
    email: optional(values.Email),
    pec,
    taxCode: optional(record.taxCodeNormalized),
    vatNumber: optional(record.vatNumberNormalized),
    uniqueCode,
    notes: optional(notes),
  };
}

function getMatchReasons(record: SourceRecord, vatKeys: Set<string>, taxCodeKeys: Set<string>) {
  const reasons: string[] = [];
  if (record.vatNumberNormalized && vatKeys.has(record.vatNumberNormalized)) reasons.push("P.IVA");
  if (record.taxCodeNormalized && taxCodeKeys.has(record.taxCodeNormalized)) reasons.push("Codice fiscale");
  return reasons;
}

async function readSource() {
  return JSON.parse(await fs.readFile(sourcePath, "utf8")) as SourceFile;
}

async function buildPlan(source: SourceFile) {
  const existingCustomers = await prisma.customer.findMany({
    select: { id: true, name: true, vatNumber: true, taxCode: true },
  });
  const vatKeys = new Set(existingCustomers.map((customer) => normalizeIdentifier(customer.vatNumber, 11)).filter(Boolean));
  const taxCodeKeys = new Set(existingCustomers.map((customer) => normalizeIdentifier(customer.taxCode, 11)).filter(Boolean));
  const existingMatches = [];
  const candidates = [];

  for (const record of source.records) {
    const reasons = getMatchReasons(record, vatKeys, taxCodeKeys);
    if (reasons.length) {
      existingMatches.push({
        sourceRow: record.sourceRow,
        name: record.values.Denominazione,
        vatNumber: record.vatNumberNormalized,
        taxCode: record.taxCodeNormalized,
        reasons,
      });
    } else {
      candidates.push(record);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceWorkbook: source.workbookPath,
    sourceRows: source.records.length,
    existingCustomerCount: existingCustomers.length,
    existingMatches,
    candidates,
  };
}

async function commitImport(source: SourceFile) {
  const imported: Array<{ sourceRow: number; customerId: string; name: string }> = [];
  const skippedAtCommit: Array<{ sourceRow: number; name: string; reasons: string[] }> = [];

  await prisma.$transaction(async (tx) => {
    const existingCustomers = await tx.customer.findMany({
      select: { vatNumber: true, taxCode: true },
    });
    const vatKeys = new Set(existingCustomers.map((customer) => normalizeIdentifier(customer.vatNumber, 11)).filter(Boolean));
    const taxCodeKeys = new Set(existingCustomers.map((customer) => normalizeIdentifier(customer.taxCode, 11)).filter(Boolean));

    for (const record of source.records) {
      const reasons = getMatchReasons(record, vatKeys, taxCodeKeys);
      if (reasons.length) {
        skippedAtCommit.push({ sourceRow: record.sourceRow, name: record.values.Denominazione, reasons });
        continue;
      }

      const customer = await tx.customer.create({ data: buildCustomerData(record) });
      await tx.auditLog.create({
        data: {
          entityType: "CUSTOMER",
          entityId: customer.id,
          entityLabel: customer.name,
          actionType: "CREATED",
          title: "Cliente importato da Excel",
          details: [customer.phone, customer.email].filter(Boolean).join(" • ") || "Importazione anagrafica clienti",
          snapshotAfter: {
            id: customer.id,
            name: customer.name,
            type: customer.type,
            phone: customer.phone,
            whatsapp: customer.whatsapp,
            email: customer.email,
            pec: customer.pec,
            taxCode: customer.taxCode,
            vatNumber: customer.vatNumber,
            uniqueCode: customer.uniqueCode,
            notes: customer.notes,
            createdAt: customer.createdAt.toISOString(),
            updatedAt: customer.updatedAt.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });

      if (record.vatNumberNormalized) vatKeys.add(record.vatNumberNormalized);
      if (record.taxCodeNormalized) taxCodeKeys.add(record.taxCodeNormalized);
      imported.push({ sourceRow: record.sourceRow, customerId: customer.id, name: customer.name });
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 10_000,
    timeout: 120_000,
  });

  return {
    committedAt: new Date().toISOString(),
    sourceRows: source.records.length,
    imported,
    skippedAtCommit,
  };
}

async function verifyImport(source: SourceFile) {
  const result = JSON.parse(await fs.readFile(resultPath, "utf8")) as {
    imported: Array<{ sourceRow: number; customerId: string; name: string }>;
    skippedAtCommit: Array<{ sourceRow: number; name: string; reasons: string[] }>;
  };
  const importedIds = result.imported.map((entry) => entry.customerId);
  const [customers, importedCustomers, auditLogCount] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, vatNumber: true, taxCode: true } }),
    prisma.customer.findMany({
      where: { id: { in: importedIds } },
      select: { id: true, name: true, vatNumber: true, taxCode: true },
    }),
    prisma.auditLog.count({
      where: {
        entityType: "CUSTOMER",
        entityId: { in: importedIds },
        actionType: "CREATED",
        title: "Cliente importato da Excel",
      },
    }),
  ]);
  const sourceByRow = new Map(source.records.map((record) => [record.sourceRow, record]));
  const importedById = new Map(importedCustomers.map((customer) => [customer.id, customer]));
  const allVatKeys = customers.map((customer) => normalizeIdentifier(customer.vatNumber, 11)).filter(Boolean);
  const allTaxCodeKeys = customers.map((customer) => normalizeIdentifier(customer.taxCode, 11)).filter(Boolean);
  const issues: string[] = [];

  for (const entry of result.imported) {
    const sourceRecord = sourceByRow.get(entry.sourceRow);
    const customer = importedById.get(entry.customerId);
    if (!sourceRecord || !customer) {
      issues.push(`Riga ${entry.sourceRow}: record sorgente o cliente importato mancante.`);
      continue;
    }
    const customerVat = normalizeIdentifier(customer.vatNumber, 11);
    const customerTaxCode = normalizeIdentifier(customer.taxCode, 11);
    if (customerVat !== sourceRecord.vatNumberNormalized || customerTaxCode !== sourceRecord.taxCodeNormalized) {
      issues.push(`Riga ${entry.sourceRow}: chiavi fiscali non coincidenti.`);
    }
    if (customerVat && allVatKeys.filter((key) => key === customerVat).length !== 1) {
      issues.push(`Riga ${entry.sourceRow}: P.IVA duplicata dopo l'importazione.`);
    }
    if (customerTaxCode && allTaxCodeKeys.filter((key) => key === customerTaxCode).length !== 1) {
      issues.push(`Riga ${entry.sourceRow}: codice fiscale duplicato dopo l'importazione.`);
    }
  }

  if (importedCustomers.length !== result.imported.length) issues.push("Numero clienti importati non coerente con il risultato.");
  if (auditLogCount !== result.imported.length) issues.push("Numero registri attività non coerente con i clienti importati.");
  if (issues.length) throw new Error(issues.join("\n"));

  return {
    totalCustomers: customers.length,
    importedCustomers: importedCustomers.length,
    skippedExisting: result.skippedAtCommit.length,
    auditLogs: auditLogCount,
    duplicateImportedKeys: 0,
  };
}

async function main() {
  const source = await readSource();

  if (verify) {
    const verification = await verifyImport(source);
    console.log(JSON.stringify({ mode: "verify", ...verification }, null, 2));
    return;
  }

  if (!commit) {
    const plan = await buildPlan(source);
    await fs.writeFile(planPath, JSON.stringify(plan, null, 2));
    console.log(JSON.stringify({
      mode: "dry-run",
      existingCustomerCount: plan.existingCustomerCount,
      sourceRows: plan.sourceRows,
      existingMatches: plan.existingMatches.length,
      candidates: plan.candidates.length,
      planPath,
    }, null, 2));
    return;
  }

  const result = await commitImport(source);
  await fs.writeFile(resultPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({
    mode: "commit",
    sourceRows: result.sourceRows,
    imported: result.imported.length,
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
