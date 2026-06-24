const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.sendStatus(401);
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'admin') {
      const admin = await prisma.admin.findUnique({ where: { id: decoded.id } });
      if (!admin) return res.sendStatus(403);
      req.user = { ...admin, type: 'admin' };
    } else if (decoded.type === 'merchant') {
      const merchant = await prisma.merchant.findUnique({ where: { id: decoded.id } });
      if (!merchant) return res.sendStatus(403);
      req.user = { ...merchant, type: 'merchant' };
    } else if (decoded.type === 'pos') {
      const pos = await prisma.pOSDevice.findUnique({ where: { id: decoded.id } });
      if (!pos) return res.sendStatus(403);
      req.user = { ...pos, type: 'pos' };
    } else {
      return res.sendStatus(403);
    }
    next();
  } catch (err) {
    logger.error('Auth token verification failed', { error: err.message });
    return res.sendStatus(403);
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.type !== 'admin') {
    return res.sendStatus(403);
  }
  next();
}

function requireMerchant(req, res, next) {
  if (req.user?.type !== 'merchant') {
    return res.sendStatus(403);
  }
  next();
}

function requirePOS(req, res, next) {
  if (req.user?.type !== 'pos') {
    return res.sendStatus(403);
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin,
  requireMerchant,
  requirePOS
};
