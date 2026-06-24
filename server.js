/**
 * Production entry point for Railway.
 * Serves the backend API + all 3 React apps as static files.
 */
require('dotenv').config();
const express  = require('express');
const path     = require('path');
const cors     = require('cors');
const helmet   = require('helmet');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const Stripe   = require('stripe');
const { z }    = require('zod');
const hpp      = require('hpp');

// ── Re-use the single app from index.js ──────────────────────────────────────
// index.js exports `app` and only calls app.listen when run directly.
// Here we call app.listen ourselves after adding static file routes.
const app  = require('./index');
const PORT = process.env.PORT || 3000;

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// ── Static frontends ─────────────────────────────────────────────────────────
const dist = (name) => path.join(__dirname, name, 'dist');

// Admin → /admin
app.use('/admin', express.static(dist('admin-dashboard')));
app.use('/admin', (_req, res) => res.sendFile(path.join(dist('admin-dashboard'), 'index.html')));

// Merchant → /merchant
app.use('/merchant', express.static(dist('merchant-dashboard')));
app.use('/merchant', (_req, res) => res.sendFile(path.join(dist('merchant-dashboard'), 'index.html')));

// POS → / (root, must be last)
app.use(express.static(dist('pos-app')));
app.use((_req, res) => res.sendFile(path.join(dist('pos-app'), 'index.html')));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`PrimeStack MOTO POS running on port ${PORT}`);
});
