/**
 * Production server — serves the API + all 3 static frontends from one process.
 * On Railway everything runs here on PORT 3000.
 */

// Load the full API from index.js and add static file serving on top
const path = require('path');

// Patch PORT before loading index.js so it uses Railway's PORT
process.env.PORT = process.env.PORT || 3000;

// Import the express app from index.js
const app = require('./index');

const PORT = process.env.PORT || 3000;

// ── Serve built frontend apps ────────────────────────────────────────────────

// Admin Dashboard → /admin
app.use('/admin', require('express').static(path.join(__dirname, 'admin-dashboard', 'dist')));
app.get('/admin/{*path}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard', 'dist', 'index.html'));
});

// Merchant Dashboard → /merchant
app.use('/merchant', require('express').static(path.join(__dirname, 'merchant-dashboard', 'dist')));
app.get('/merchant/{*path}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'merchant-dashboard', 'dist', 'index.html'));
});

// POS App → / (catch-all last)
app.use(require('express').static(path.join(__dirname, 'pos-app', 'dist')));
app.get('/{*path}', (_req, res) => {
  // Don't serve index.html for API routes
  res.sendFile(path.join(__dirname, 'pos-app', 'dist', 'index.html'));
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`PrimeStack MOTO POS running on port ${PORT}`);
  console.log(`Admin:    /admin`);
  console.log(`Merchant: /merchant`);
  console.log(`POS:      /`);
});
