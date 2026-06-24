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

// ── Health check endpoint (required by Railway) ───────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

// POS App → / (must be last — but never intercept API routes)
app.use(require('express').static(path.join(__dirname, 'pos-app', 'dist')));
app.get('/{*path}', (req, res, next) => {
  // Let API routes pass through
  const apiPrefixes = ['/admin/', '/merchant/', '/pos/', '/webhooks/', '/stripe/', '/system/', '/api/'];
  if (apiPrefixes.some(p => req.path.startsWith(p))) return next();
  res.sendFile(path.join(__dirname, 'pos-app', 'dist', 'index.html'));
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`PrimeStack MOTO POS running on port ${PORT}`);
  console.log(`Admin:    /admin`);
  console.log(`Merchant: /merchant`);
  console.log(`POS:      /`);
});
