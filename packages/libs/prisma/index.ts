import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismadb: PrismaClient | undefined;
}

// Re-use one client per process (avoids exhausting connections on hot reload)
const prisma = global.prismadb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") global.prismadb = prisma;

export default prisma;
