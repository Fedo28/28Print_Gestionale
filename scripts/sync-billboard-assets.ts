import { ensureBillboardAssets } from "../lib/billboards";
import { prisma } from "../lib/prisma";

async function main() {
  await ensureBillboardAssets();

  const assets = await prisma.billboardAsset.findMany({
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: {
      code: true,
      name: true,
      location: true,
      kind: true,
      sortOrder: true,
      active: true
    }
  });

  console.log(JSON.stringify(assets, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
