const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Check if admin already exists
  const existingAdmin = await prisma.admin.findUnique({
    where: { email: 'admin@primestack.com' }
  });

  if (existingAdmin) {
    console.log('Admin user already exists!');
    console.log('Email: admin@primestack.com');
    console.log('Password: admin123');
    return;
  }

  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.admin.create({
    data: {
      email: 'admin@primestack.com',
      password: hashedPassword,
      name: 'Admin'
    }
  });
  console.log('Admin user created successfully!');
  console.log('Email: admin@primestack.com');
  console.log('Password: admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
