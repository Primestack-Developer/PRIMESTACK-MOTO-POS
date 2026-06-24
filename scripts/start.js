const { execSync } = require('child_process');

console.log('Starting PrimeStack MOTO POS...');

// Run database migrations
try {
  console.log('Running database migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  console.log('Migrations complete.');
} catch (e) {
  console.log('Migration note:', e.message);
}

// Seed admin if needed
try {
  console.log('Running seed...');
  execSync('node seed.js', { stdio: 'inherit' });
} catch (e) {
  console.log('Seed note:', e.message);
}

// Start the server
console.log('Starting server...');
require('../server');
