// Simple logger that replaces winston — no external dependency needed
const logger = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data ? JSON.stringify(data) : ''),
  warn: (msg, data) => console.warn(`[WARN] ${msg}`, data ? JSON.stringify(data) : ''),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data ? JSON.stringify(data) : ''),
  debug: (msg, data) => { if (process.env.NODE_ENV !== 'production') console.log(`[DEBUG] ${msg}`, data ? JSON.stringify(data) : '') }
};

module.exports = logger;
