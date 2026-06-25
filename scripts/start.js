const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const prodSchemaSrc = path.join(__dirname, '..', 'prisma', 'schema.production.prisma');
const schemaDest = path.join(__dirname, '..', 'prisma', 'schema.prisma');

const run = (command, options = {}) => {
  execSync(command, { stdio: 'inherit', ...options });
};

console.log('Starting PrimeStack MOTO POS...');

if (process.env.NODE_ENV === 'production') {
  try {
    fs.copyFileSync(prodSchemaSrc, schemaDest);
    console.log('✅ Production Prisma schema copied to prisma/schema.prisma');
  } catch (error) {
    console.error('❌ Failed to copy production Prisma schema:', error.message || error);
    process.exit(1);
  }
}

try {
  console.log('Running database migrations...');
  run('npx prisma migrate deploy --schema=./prisma/schema.prisma');
  console.log('✅ Migrations complete.');
} catch (error) {
  console.error('❌ Migrations failed:');
  console.error(error.message || error);
  process.exit(1);
}

try {
  console.log('Running seed script...');
  run('node seed.js');
  console.log('✅ Seed completed.');
} catch (error) {
  console.warn('⚠️ Seed script failed or was skipped:');
  console.warn(error.message || error);
}

console.log('Starting server...');
require('../server');
