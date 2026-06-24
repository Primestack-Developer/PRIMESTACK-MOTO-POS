require('dotenv').config();
const express = require('express');
const path    = require('path');

// Import the API app (no listen inside when required as module)
const app  = require('./index');
const PORT = process.env.PORT || 3000;

const dist = (name) => path.join(__dirname, name, 'dist');

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// ── Admin Dashboard → /admin ──────────────────────────────────────────────────
app.use('/admin', express.static(dist('admin-dashboard'), { index: 'index.html' }));
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(dist('admin-dashboard'), 'index.html'));
});
app.get('/admin/*', (_req, res) => {
  res.sendFile(path.join(dist('admin-dashboard'), 'index.html'));
});

// ── Merchant Dashboard → /merchant ───────────────────────────────────────────
app.use('/merchant', express.static(dist('merchant-dashboard'), { index: 'index.html' }));
app.get('/merchant', (_req, res) => {
  res.sendFile(path.join(dist('merchant-dashboard'), 'index.html'));
});
app.get('/merchant/*', (_req, res) => {
  res.sendFile(path.join(dist('merchant-dashboard'), 'index.html'));
});

// ── POS App → / (root, catch-all last) ────────────────────────────────────────
app.use(express.static(dist('pos-app'), { index: 'index.html' }));
app.get('*', (_req, res) => {
  res.sendFile(path.join(dist('pos-app'), 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`PrimeStack MOTO POS on port ${PORT}`);
  console.log(`  Admin:    /admin`);
  console.log(`  Merchant: /merchant`);
  console.log(`  POS:      /`);
});
