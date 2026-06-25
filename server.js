require('dotenv').config();
const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// ── Mount API routes WITH security middleware ─────────────────────────────────
const api = require('./index');
app.use(api);

// ── Static frontend files WITHOUT security middleware ─────────────────────────
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

// POS App at / (root) - catch-all LAST
app.use(express.static(dist('pos-app')));
app.use((_req, res) => {
  res.sendFile(path.join(dist('pos-app'), 'index.html'));
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`PrimeStack MOTO POS running on port ${PORT}`);
  console.log(`  Admin:    /admin`);
  console.log(`  Merchant: /merchant`);
  console.log(`  POS:      /`);
});
