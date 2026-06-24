require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const adminRoutes = require('./src/routes/adminRoutes');
const merchantRoutes = require('./src/routes/merchantRoutes');
const posRoutes = require('./src/routes/posRoutes');
const webhookRoutes = require('./src/routes/webhookRoutes');
const errorHandler = require('./src/middleware/errorHandler');
const logger = require('./src/utils/logger');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

app.use(cors());
app.use('/webhooks', webhookRoutes);
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api', (req, res) => {
  res.json({ message: 'PrimeStack MOTO POS API' });
});

app.use('/api/admin', adminRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/pos', posRoutes);

// Serve Admin Dashboard
app.use('/admin', express.static(path.join(__dirname, 'admin-dashboard', 'dist')));
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard', 'dist', 'index.html'));
});

// Serve Merchant Dashboard
app.use('/merchant', express.static(path.join(__dirname, 'merchant-dashboard', 'dist')));
app.get('/merchant/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'merchant-dashboard', 'dist', 'index.html'));
});

// Serve POS App
app.use('/', express.static(path.join(__dirname, 'pos-app', 'dist')));
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'pos-app', 'dist', 'index.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`Server running on port ${PORT}`);
});
