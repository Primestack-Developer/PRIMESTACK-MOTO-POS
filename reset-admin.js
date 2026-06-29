const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.admin.updateMany({
    data: { failedLogins: 0, lockedUntil: null }
  });
  console.log('Admin lockout reset. Updated:', result.count, 'admin(s)');
  console.log('You can now login with admin@primestack.com / admin123');
}

main().finally(() => prisma.$disconnect());
