require('dotenv').config();
const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Health check — responds immediately, no dependencies ──────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// ── Static frontend files FIRST (before API!) ─────────────────────────────────
const dist = (name) => path.join(__dirname, name, 'dist');

// Admin Dashboard at /admin
app.use('/admin', express.static(dist('admin-dashboard')));
app.use('/admin', (_req, res) => {
  res.sendFile(path.join(dist('admin-dashboard'), 'index.html'));
});

// Merchant Dashboard at /merchant
app.use('/merchant', express.static(dist('merchant-dashboard')));
app.use('/merchant', (_req, res) => {
  res.sendFile(path.join(dist('merchant-dashboard'), 'index.html'));
});

// POS App at / (root)
app.use(express.static(dist('pos-app')));
app.use((_req, res) => {
  res.sendFile(path.join(dist('pos-app'), 'index.html'));
});

// ── Mount full API LAST ───────────────────────────────────────────────────────
// index.js exports app without calling listen (require.main guard)
const api = require('./index');
app.use(api);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`PrimeStack MOTO POS running on port ${PORT}`);
  console.log(`  Admin:    /admin`);
  console.log(`  Merchant: /merchant`);
  console.log(`  POS:      /`);
});
