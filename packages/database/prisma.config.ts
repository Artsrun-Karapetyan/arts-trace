import { defineConfig } from "prisma/config";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const datasourceUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!datasourceUrl) {
  throw new Error("DATABASE_URL or DIRECT_URL is required");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: datasourceUrl
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts"
  }
});
