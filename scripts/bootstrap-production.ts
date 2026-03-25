import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth-core";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} mancante.`);
  }

  return value;
}

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
