const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash('admin123', 10);
  await prisma.admin.update({
    where: { email: 'admin@primestack.com' },
    data: { password: hashed, failedLogins: 0, lockedUntil: null }
  });
  console.log('Admin password reset to: admin123');
}
main().finally(() => prisma.$disconnect());
