require('dotenv').config();
const { execSync } = require('child_process');
const express = require('express');
const path    = require('path');

// ── Run migrations and seed before starting ───────────────────────────────────
try {
  console.log('Running database migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
} catch (e) {
  console.log('Migration note:', e.message);
}

try {
  console.log('Seeding database...');
  execSync('node seed.js', { stdio: 'inherit' });
} catch (e) {
  console.log('Seed note:', e.message);
}

// ── Import the API app ────────────────────────────────────────────────────────
const app  = require('./index');
const PORT = process.env.PORT || 3000;

const dist = (name) => path.join(__dirname, name, 'dist');

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// ── Admin Dashboard ───────────────────────────────────────────────────────────
app.use('/admin', express.static(dist('admin-dashboard')));
app.get('/admin', (_req, res) => res.sendFile(path.join(dist('admin-dashboard'), 'index.html')));
app.get('/admin/*', (_req, res) => res.sendFile(path.join(dist('admin-dashboard'), 'index.html')));

// ── Merchant Dashboard ────────────────────────────────────────────────────────
app.use('/merchant', express.static(dist('merchant-dashboard')));
app.get('/merchant', (_req, res) => res.sendFile(path.join(dist('merchant-dashboard'), 'index.html')));
app.get('/merchant/*', (_req, res) => res.sendFile(path.join(dist('merchant-dashboard'), 'index.html')));

// ── POS App (root, catch-all last) ────────────────────────────────────────────
app.use(express.static(dist('pos-app')));
app.get('*', (_req, res) => res.sendFile(path.join(dist('pos-app'), 'index.html')));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`PrimeStack MOTO POS running on port ${PORT}`);
  console.log(`  Admin:    /admin`);
  console.log(`  Merchant: /merchant`);
  console.log(`  POS:      /`);
});
