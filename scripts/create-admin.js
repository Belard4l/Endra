/**
 * Creates (or promotes) the first HUZA admin.
 *
 *   node scripts/create-admin.js "Your Name" you@example.com "a-strong-password"
 *
 * Reads DATABASE_URL from the .env file in the project root.
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

(async () => {
  const [name, emailArg, password] = process.argv.slice(2);
  if (!name || !emailArg || !password || password.length < 10) {
    console.error('Usage: node scripts/create-admin.js "Full Name" email@example.com "password-of-10+-chars"');
    process.exit(1);
  }
  const email = emailArg.toLowerCase().trim();
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.users.findUnique({ where: { email } });
    const hashed = await bcrypt.hash(password, 10);
    if (existing) {
      await prisma.users.update({ where: { email }, data: { role: "admin", password: hashed } });
      console.log(`✔ ${email} is now an admin (password updated).`);
    } else {
      await prisma.users.create({ data: { name, email, password: hashed, role: "admin" } });
      console.log(`✔ Admin ${email} created.`);
    }
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
