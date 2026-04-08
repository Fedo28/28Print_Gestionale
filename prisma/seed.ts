import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth-core";
import { buildOrderCode, normalizeForUniqueness } from "../lib/orders";
import { formatDateKey } from "../lib/format";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Il seed demo locale non puo essere eseguito in produzione.");
  }

  const demoServices = [
    {
      code: "BIGLIETTI_DA_VISITA_DEMO",
      name: "Biglietti da visita",
      description: "Stampa fronte/retro su cartoncino",
      basePriceCents: 2500
    },
    {
      code: "MANIFESTI_A3_DEMO",
      name: "Manifesti A3",
      description: "Carta patinata alta resa",
      basePriceCents: 900
    },
    {
      code: "ADESIVI_VETRINA_DEMO",
      name: "Adesivi vetrina",
      description: "Taglio e applicazione a misura",
      basePriceCents: 4500
    }
  ];

  for (const service of demoServices) {
    await prisma.serviceCatalog.upsert({
      where: { code: service.code },
      update: {
        name: service.name,
        description: service.description,
        basePriceCents: service.basePriceCents,
        active: true
      },
      create: service
    });
  }

  const existingCustomer = await prisma.customer.findFirst({
    where: {
      email: "info@officinarossi.it"
    }
  });

  const customer = existingCustomer
    ? await prisma.customer.update({
        where: {
          id: existingCustomer.id
        },
        data: {
          name: "Officina Rossi",
          type: "AZIENDA",
          phone: "+39 333 1234567",
          whatsapp: "+39 333 1234567",
          vatNumber: "IT12345678901"
        }
      })
    : await prisma.customer.create({
        data: {
          name: "Officina Rossi",
          type: "AZIENDA",
          phone: "+39 333 1234567",
          whatsapp: "+39 333 1234567",
          email: "info@officinarossi.it",
          vatNumber: "IT12345678901"
        }
      });

  await prisma.user.upsert({
    where: {
      email: "admin@fede.local"
    },
    update: {
      name: "Admin",
      nickname: "fedo",
      passwordHash: hashPassword("admin123"),
      role: "ADMIN"
    },
    create: {
      name: "Admin",
      nickname: "fedo",
      email: "admin@fede.local",
      passwordHash: hashPassword("admin123"),
      role: "ADMIN"
    }
  });

  const createdAt = new Date();
  const createdOn = formatDateKey(createdAt);
  const title = "Biglietti visita Rossi";
  const orderCode = buildOrderCode(createdAt, title);

  let order = await prisma.order.findUnique({
    where: { orderCode }
  });

  if (!order) {
    order = await prisma.order.create({
      data: {
        customerId: customer.id,
        orderCode,
        title,
        titleNormalized: normalizeForUniqueness(title),
        createdAt,
        createdOn,
        deliveryAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        priority: "ALTA",
        mainPhase: "IN_LAVORAZIONE",
        operationalStatus: "ATTIVO",
        paymentStatus: "ACCONTO",
        invoiceStatus: "DA_FATTURARE",
        totalCents: 5000,
        depositCents: 2000,
        paidCents: 2000,
        balanceDueCents: 3000,
        notes: "Urgente per evento weekend",
        items: {
          create: [
            {
              label: "Biglietti visita 500pz",
              quantity: 1,
              unitPriceCents: 5000,
              lineTotalCents: 5000,
              format: "85x55",
              material: "Cartoncino 350gr"
            }
          ]
        },
        payments: {
          create: {
            amountCents: 2000,
            method: "CARTA",
            note: "Acconto al banco"
          }
        },
        history: {
          create: [
            {
              type: "CREATED",
              description: "Ordine creato"
            },
            {
              type: "PHASE_CHANGED",
              description: "Fase ordine aggiornata a IN_LAVORAZIONE"
            }
          ]
        }
      }
    });
  }

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

  console.log("Seed locale completato", { services: demoServices.length, customerId: customer.id, orderId: order.id });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
