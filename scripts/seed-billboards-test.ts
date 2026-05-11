import { prisma } from "../lib/prisma";
import { calculateBillboardBookingBalanceCents, ensureBillboardAssets } from "../lib/billboards";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Lo script demo cartelloni non puo essere eseguito in produzione.");
  }

  await ensureBillboardAssets();

  const testCustomers = [
    {
      email: "cartelloni-test-1@demo.local",
      name: "Demo Cartelloni Rossi",
      type: "AZIENDA" as const,
      phone: "+39 333 1000001"
    },
    {
      email: "cartelloni-test-2@demo.local",
      name: "Demo Cartelloni Bianchi",
      type: "AZIENDA" as const,
      phone: "+39 333 1000002"
    },
    {
      email: "cartelloni-test-3@demo.local",
      name: "Demo Cartelloni Verdi",
      type: "PUBBLICO" as const,
      phone: "+39 333 1000003"
    },
    {
      email: "cartelloni-test-4@demo.local",
      name: "Demo Cartelloni Blu",
      type: "AZIENDA" as const,
      phone: "+39 333 1000004"
    },
    {
      email: "cartelloni-test-5@demo.local",
      name: "Demo Cartelloni Gialli",
      type: "PUBBLICO" as const,
      phone: "+39 333 1000005"
    },
    {
      email: "cartelloni-test-6@demo.local",
      name: "Demo Cartelloni Eventi",
      type: "AZIENDA" as const,
      phone: "+39 333 1000006"
    }
  ];

  const customers = [];
  for (const customer of testCustomers) {
    const existing = await prisma.customer.findFirst({
      where: {
        email: customer.email
      }
    });

    const record = existing
      ? await prisma.customer.update({
          where: { id: existing.id },
          data: {
            name: customer.name,
            type: customer.type,
            phone: customer.phone,
            whatsapp: customer.phone,
            email: customer.email
          }
        })
      : await prisma.customer.create({
          data: {
            name: customer.name,
            type: customer.type,
            phone: customer.phone,
            whatsapp: customer.phone,
            email: customer.email
          }
        });
    customers.push(record);
  }

  await prisma.billboardBooking.deleteMany({
    where: {
      customerId: {
        in: customers.map((customer) => customer.id)
      }
    }
  });

  const assets = await prisma.billboardAsset.findMany({
    where: {
      code: {
        in: ["1001", "1002", "1007", "MONITOR_01", "1016", "1022"]
      }
    }
  });

  const assetByCode = new Map(assets.map((asset) => [asset.code, asset]));

  const bookings = [
    {
      assetCode: "1001",
      customerIndex: 0,
      startsAt: new Date("2026-05-08T12:00:00"),
      endsAt: new Date("2026-05-12T12:00:00"),
      priceCents: 42000,
      paidCents: 12000,
      note: "Promo officina primavera"
    },
    {
      assetCode: "1002",
      customerIndex: 1,
      startsAt: new Date("2026-05-10T12:00:00"),
      endsAt: new Date("2026-05-18T12:00:00"),
      priceCents: 58000,
      paidCents: 58000,
      note: "Campagna gia saldata"
    },
    {
      assetCode: "1007",
      customerIndex: 2,
      startsAt: new Date("2026-05-12T12:00:00"),
      endsAt: new Date("2026-05-20T12:00:00"),
      priceCents: 36000,
      paidCents: 0,
      note: "Lancio nuova attivita"
    },
    {
      assetCode: "MONITOR_01",
      customerIndex: 3,
      startsAt: new Date("2026-05-14T12:00:00"),
      endsAt: new Date("2026-05-16T12:00:00"),
      priceCents: 24000,
      paidCents: 10000,
      note: "Monitor centro commerciale"
    },
    {
      assetCode: "1016",
      customerIndex: 4,
      startsAt: new Date("2026-05-22T12:00:00"),
      endsAt: new Date("2026-05-28T12:00:00"),
      priceCents: 30000,
      paidCents: 15000,
      note: "Promozione evento weekend"
    },
    {
      assetCode: "1022",
      customerIndex: 5,
      startsAt: new Date("2026-05-29T12:00:00"),
      endsAt: new Date("2026-06-06T12:00:00"),
      priceCents: 64000,
      paidCents: 0,
      note: "Campagna stagionale giugno"
    }
  ];

  for (const booking of bookings) {
    const asset = assetByCode.get(booking.assetCode);
    if (!asset) {
      continue;
    }

    await prisma.billboardBooking.create({
      data: {
        billboardAssetId: asset.id,
        customerId: customers[booking.customerIndex].id,
        status: "CONFERMATO",
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        priceCents: booking.priceCents,
        paidCents: booking.paidCents,
        balanceDueCents: calculateBillboardBookingBalanceCents(booking.priceCents, booking.paidCents),
        note: booking.note
      }
    });
  }

  console.log("Demo cartelloni creati", {
    bookings: bookings.length,
    customers: customers.length
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
