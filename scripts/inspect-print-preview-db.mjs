import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

// Riceve SOLO la risposta della singola variabile DATABASE_URL di V1 su stdin.
// Nessun file di credenziali, nessuna stampa del valore e nessuna scrittura sul DB.
let input = "";
for await (const chunk of process.stdin) input += chunk;
const variable = JSON.parse(input);
input = "";
if (variable.key !== "DATABASE_URL" || !variable.target?.includes("preview")) throw Error("Variabile o ambiente inatteso.");
const url = new URL(variable.value);
if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "db.prisma.io" || url.pathname !== "/postgres") {
  throw Error("Il database non corrisponde alla destinazione V1 verificata. Nessuna connessione eseguita.");
}
const prisma = new PrismaClient({ datasources: { db: { url: variable.value } } });
const databaseFingerprint = createHash("sha256").update(variable.value).digest("hex");
variable.value = "";
try {
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const tables = await tx.$queryRawUnsafe("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    const counts = {};
    for (const table of ["User", "Customer", "Order", "Attachment", "PrintBridge", "PrintJob", "_prisma_migrations"]) {
      if (tables.some(row => row.tablename === table)) {
        const rows = await tx.$queryRawUnsafe(`SELECT COUNT(*)::text AS count FROM "public"."${table}"`);
        counts[table] = rows[0].count;
      }
    }
    return { host: url.hostname, database: url.pathname.slice(1), databaseFingerprint, schema: "public", tables: tables.map(row => row.tablename), counts };
  }, { timeout: 20000 });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("Verifica DB V1 non completata; nessuna scrittura eseguita.", error.code || error.name);
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
