import path from "path";
import { fileURLToPath } from "url";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth-core";
import {
  bootstrapServiceCatalogTemplateIfEmpty,
  importServiceCatalogWorkbookFile
} from "../lib/service-catalog-import";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} mancante.`);
  }

  return value;
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogTemplatePath = path.join(projectRoot, "catalogo_servizi_template.xlsx");

async function main() {
  const adminName = requireEnv("ADMIN_NAME");
  const adminEmail = requireEnv("ADMIN_EMAIL").toLowerCase();
  const adminPassword = requireEnv("ADMIN_PASSWORD");

  await prisma.user.upsert({
    where: {
      email: adminEmail
    },
    update: {
      name: adminName,
      passwordHash: hashPassword(adminPassword),
      role: "ADMIN"
    },
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash: hashPassword(adminPassword),
      role: "ADMIN"
    }
  });

  await prisma.appSetting.upsert({
    where: {
      key: "whatsappTemplate"
    },
    update: {},
    create: {
      key: "whatsappTemplate",
      value: "Ciao {nome_cliente}, il tuo ordine {order_code} e pronto per il ritiro."
    }
  });

  await bootstrapServiceCatalogTemplateIfEmpty({
    templatePath: catalogTemplatePath,
    countServices: () => prisma.serviceCatalog.count(),
    importWorkbookFile: importServiceCatalogWorkbookFile,
    logger: console
  });

  console.log("Production bootstrap completed.");
}

main()
  .catch((error) => {
    console.error("Production bootstrap failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
