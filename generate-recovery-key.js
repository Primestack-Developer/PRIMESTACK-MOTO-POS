const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  // Generate a secure 64-character recovery key
  const recoveryKey = 'PS-RK-' + crypto.randomBytes(32).toString('hex').toUpperCase();
  
  const admin = await prisma.admin.findFirst();
  if (!admin) { console.log('No admin found. Run seed.js first.'); return; }
  
  await prisma.admin.update({
    where: { id: admin.id },
    data: { recoveryKey, failedLogins: 0, lockedUntil: null }
  });
  
  console.log('\n========================================');
  console.log('  PRIMESTACK ADMIN RECOVERY KEY');
  console.log('========================================');
  console.log('\n  SAVE THIS KEY SOMEWHERE SAFE.');
  console.log('  You cannot retrieve it again.\n');
  console.log('  ' + recoveryKey);
  console.log('\n========================================');
  console.log('  Admin:', admin.email);
  console.log('  Use at: /admin/login (Recovery Key tab)');
  console.log('========================================\n');
}

main().finally(() => prisma.$disconnect());
