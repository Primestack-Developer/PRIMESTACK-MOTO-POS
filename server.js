require('dotenv').config();
const express = require('express');
const path    = require('path');
const PORT    = process.env.PORT || 3000;

// ── Minimal express app that responds to /health immediately ──────────────────
const app = express();

// Health check must respond FAST before anything else loads
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// ── Load full API async so health check is always available ───────────────────
let apiReady = false;

async function loadAPI() {
  try {
    console.log('Running migrations...');
    const { execSync } = require('child_process');
    try { execSync('npx prisma migrate deploy', { stdio: 'inherit' }); } catch(e) { console.log('Migration:', e.message); }
    try { execSync('node seed.js', { stdio: 'inherit' }); } catch(e) { console.log('Seed:', e.message); }

    console.log('Loading API...');
    const apiApp = require('./index');

    // Mount API routes
    app.use(apiApp);
    apiReady = true;
    console.log('API loaded successfully.');
  } catch(e) {
    console.error('API load error:', e.message);
  }
}

// ── Static frontends ──────────────────────────────────────────────────────────
const dist = (name) => path.join(__dirname, name, 'dist');

app.use('/admin',    express.static(dist('admin-dashboard')));
app.use('/merchant', express.static(dist('merchant-dashboard')));
app.use(            express.static(dist('pos-app')));

app.get('/admin',    (_req, res) => res.sendFile(path.join(dist('admin-dashboard'),    'index.html')));
app.get('/admin/*',  (_req, res) => res.sendFile(path.join(dist('admin-dashboard'),    'index.html')));
app.get('/merchant', (_req, res) => res.sendFile(path.join(dist('merchant-dashboard'), 'index.html')));
app.get('/merchant/*',(_req, res) => res.sendFile(path.join(dist('merchant-dashboard'),'index.html')));
app.get('*',         (_req, res) => res.sendFile(path.join(dist('pos-app'),            'index.html')));

// ── Start server FIRST then load API ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  loadAPI();
});
