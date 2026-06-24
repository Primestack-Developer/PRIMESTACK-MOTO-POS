/**
 * Copies schema.production.prisma → schema.prisma before production build.
 * Works on both Windows and Linux (Railway).
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'prisma', 'schema.production.prisma');
const dest = path.join(__dirname, '..', 'prisma', 'schema.prisma');

fs.copyFileSync(src, dest);
console.log('✅ Switched to PostgreSQL schema for production build.');
