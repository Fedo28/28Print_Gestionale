import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx --tsconfig tsconfig.json prisma/seed.ts"
  }
});
