import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth-core";
import { buildOrderCode, normalizeForUniqueness } from "../lib/orders";
import { formatDateKey } from "../lib/format";

async function main() {
  await prisma.orderHistory.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.serviceCatalog.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.user.deleteMany();

  const services = await prisma.serviceCatalog.createMany({
    data: [
      {
        name: "Biglietti da visita",
        description: "Stampa fronte/retro su cartoncino",
        basePriceCents: 2500
      },
      {
        name: "Manifesti A3",
        description: "Carta patinata alta resa",
        basePriceCents: 900
      },
      {
        name: "Adesivi vetrina",
        description: "Taglio e applicazione a misura",
        basePriceCents: 4500
      }
    ]
  });

  const customer = await prisma.customer.create({
    data: {
      name: "Officina Rossi",
      phone: "+39 333 1234567",
      whatsapp: "+39 333 1234567",
      email: "info@officinarossi.it",
      vatNumber: "IT12345678901"
    }
  });

  await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@fede.local",
      passwordHash: hashPassword("admin123"),
      role: "ADMIN"
    }
  });

  const createdAt = new Date();
  const createdOn = formatDateKey(createdAt);
  const title = "Biglietti visita Rossi";

  const order = await prisma.order.create({
    data: {
      customerId: customer.id,
      orderCode: buildOrderCode(createdAt, title),
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

  await prisma.appSetting.create({
    data: {
      key: "whatsappTemplate",
      value: "Ciao {nome_cliente}, il tuo ordine {order_code} e pronto per il ritiro."
    }
  });

  console.log("Seed completato", { services, customerId: customer.id, orderId: order.id });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
