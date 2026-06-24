const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const MerchantService = require('../services/merchantService');
const PaymentService = require('../services/paymentService');

async function posLogin(req, res) {
  const { posId, activationCode } = req.body;
  const pos = await prisma.pOSDevice.findUnique({ where: { posId } });
  if (!pos) {
    return res.status(401).json({ error: 'Invalid POS ID' });
  }
  if (pos.status === 'pending') {
    try {
      await MerchantService.activatePOSDevice(posId, activationCode);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
  if (pos.activationCode !== activationCode) {
    return res.status(401).json({ error: 'Invalid activation code' });
  }
  if (pos.status !== 'active') {
    return res.status(403).json({ error: 'Device not active' });
  }
  const token = jwt.sign(
    { id: pos.id, posId: pos.posId, merchantId: pos.merchantId, type: 'pos' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({
    token,
    pos: {
      id: pos.id,
      posId: pos.posId,
      merchantId: pos.merchantId,
      status: pos.status
    }
  });
}

async function getPOSInfo(req, res) {
  const posId = req.user.id;
  const pos = await prisma.pOSDevice.findUnique({
    where: { id: posId },
    include: { merchant: true }
  });
  res.json(pos);
}

async function createOrder(req, res) {
  try {
    const posId = req.user.posId;
    const merchantId = req.user.merchantId;
    const { customerId, amount, currency, description } = req.body;
    const result = await PaymentService.createPaymentIntent(
      merchantId,
      posId,
      amount,
      currency,
      customerId
    );
    res.json(result);
  } catch (error) {
    logger.error('Failed to create order', { error: error.message });
    res.status(500).json({ error: error.message });
  }
}

async function processMotoPayment(req, res) {
  try {
    const posId = req.user.posId;
    const merchantId = req.user.merchantId;
    const {
      cardNumber,
      cardExpiry,
      cardCvc,
      cardholderName,
      amount,
      currency,
      customerId,
      description
    } = req.body;
    const result = await PaymentService.processMotoPayment(
      merchantId,
      posId,
      cardNumber,
      cardExpiry,
      cardCvc,
      cardholderName,
      amount,
      currency,
      customerId,
      description
    );
    res.json(result);
  } catch (error) {
    logger.error('Failed to process MOTO payment', { error: error.message });
    res.status(500).json({ error: error.message });
  }
}

async function getOrders(req, res) {
  const posId = req.user.posId;
  const orders = await prisma.order.findMany({
    where: { posId },
    include: { customer: true, payment: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(orders);
}

async function getOrderById(req, res) {
  const posId = req.user.posId;
  const { id } = req.params;
  const order = await prisma.order.findUnique({
    where: { id, posId },
    include: { customer: true, payment: true }
  });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
}

async function getCustomers(req, res) {
  const merchantId = req.user.merchantId;
  const customers = await prisma.customer.findMany({
    where: { merchantId },
    orderBy: { name: 'asc' }
  });
  res.json(customers);
}

async function createCustomer(req, res) {
  const merchantId = req.user.merchantId;
  const customer = await prisma.customer.create({
    data: {
      merchantId,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      billingAddress: req.body.billingAddress
    }
  });
  res.json(customer);
}

async function completeOrder(req, res) {
  const posId = req.user.posId;
  const { id } = req.params;
  const { paymentIntentId } = req.body;
  await PaymentService.capturePayment(paymentIntentId);
  const order = await prisma.order.update({
    where: { id, posId },
    data: { status: 'completed' },
    include: { payment: true }
  });
  res.json(order);
}

module.exports = {
  posLogin,
  getPOSInfo,
  createOrder,
  processMotoPayment,
  getOrders,
  getOrderById,
  getCustomers,
  createCustomer,
  completeOrder
};
