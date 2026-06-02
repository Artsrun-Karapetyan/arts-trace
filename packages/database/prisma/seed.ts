import { config as loadEnv } from "dotenv";
import { createRequire } from "node:module";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

loadEnv({ path: new URL("../../../.env", import.meta.url) });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client/index") as { PrismaClient: any };
const prisma = new PrismaClient({ adapter });

async function main() {
  const apiKey = process.env.ARTSTRACE_TEST_API_KEY ?? "project_public_api_key";

  await prisma.project.upsert({
    where: { apiKey },
    update: { name: "ArtsTrace Demo Project" },
    create: {
      name: "ArtsTrace Demo Project",
      apiKey
    }
  });

  console.log(`Seeded project with apiKey: ${apiKey}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
