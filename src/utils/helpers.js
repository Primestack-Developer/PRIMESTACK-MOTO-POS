const crypto = require('crypto');

function generateOrderId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

function generateMerchantId() {
  return `MCH-${Date.now().toString(36).toUpperCase()}`;
}

function generatePosId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `POS-${timestamp}-${random}`;
}

function generateActivationCode() {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

function generateTransactionId() {
  return `TXN-${Date.now().toString(36).toUpperCase()}`;
}

module.exports = {
  generateOrderId,
  generateMerchantId,
  generatePosId,
  generateActivationCode,
  generateTransactionId
};
