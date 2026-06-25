require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Health check first (no middleware)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// 2. Mount API routes (with security middleware)
const apiRouter = require('./index');
app.use(apiRouter);

// 3. Static files (NO SECURITY MIDDLEWARE AT ALL)
const dist = (name) => path.join(__dirname, name, 'dist');

app.use('/admin', express.static(dist('admin-dashboard')));
app.use('/admin', (_req, res) => {
  res.sendFile(path.join(dist('admin-dashboard'), 'index.html'));
});

app.use('/merchant', express.static(dist('merchant-dashboard')));
app.use('/merchant', (_req, res) => {
  res.sendFile(path.join(dist('merchant-dashboard'), 'index.html'));
});

app.use(express.static(dist('pos-app')));
app.use((_req, res) => {
  res.sendFile(path.join(dist('pos-app'), 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`PrimeStack MOTO POS running on port ${PORT}`);
});
