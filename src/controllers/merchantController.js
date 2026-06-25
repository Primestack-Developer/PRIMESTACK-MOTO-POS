const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const MerchantService = require('../services/merchantService');
const PaymentService = require('../services/paymentService');

async function merchantLogin(req, res) {
  const { email, password } = req.body;
  const merchant = await prisma.merchant.findUnique({ where: { email } });
  if (!merchant) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (merchant.status !== 'active') {
    return res.status(403).json({ error: 'Account not active' });
  }
  const valid = await bcrypt.compare(password, merchant.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { id: merchant.id, merchantId: merchant.merchantId, email: merchant.email, type: 'merchant' },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  res.json({
    token,
    merchant: {
      id: merchant.id,
      merchantId: merchant.merchantId,
      email: merchant.email,
      name: merchant.name,
      businessName: merchant.businessName
    }
  });
}

async function getMerchantDashboard(req, res) {
  const merchantId = req.user.id;
  const [totalOrders, totalRevenue, todayOrders, todayRevenue, activeDevices] = await Promise.all([
    prisma.order.count({ where: { merchantId } }),
    prisma.order.aggregate({
      where: { merchantId, status: { not: 'canceled' } },
      _sum: { amount: true }
    }),
    prisma.order.count({
      where: {
        merchantId,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    }),
    prisma.order.aggregate({
      where: {
        merchantId,
        status: { not: 'canceled' },
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      },
      _sum: { amount: true }
    }),
    prisma.pOSDevice.count({ where: { merchantId, status: 'active' } })
  ]);

  const recentOrders = await prisma.order.findMany({
    where: { merchantId },
    include: { posDevice: true, customer: true, payment: true },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  res.json({
    totalOrders,
    totalRevenue: totalRevenue._sum.amount || 0,
    todayOrders,
    todayRevenue: todayRevenue._sum.amount || 0,
    activeDevices,
    recentOrders
  });
}

async function getPOSDevices(req, res) {
  const merchantId = req.user.id;
  const devices = await prisma.pOSDevice.findMany({
    where: { merchantId },
    include: { deviceLogs: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ posDevices: devices });
}

async function createPOSDevice(req, res) {
  try {
    const merchantId = req.user.id;
    const device = await MerchantService.createPOSDevice(
      merchantId,
      req.body.deviceModel,
      req.body.deviceSerial
    );
    res.json({ success: true, pos_id: device.posId, activation_code: device.activationCode });
  } catch (error) {
    logger.error('Failed to create POS device', { error: error.message });
    res.status(500).json({ error: error.message });
  }
}

async function getCustomers(req, res) {
  const merchantId = req.user.id;
  const customers = await prisma.customer.findMany({
    where: { merchantId },
    include: { orders: true, verification: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ customers });
}

async function createCustomer(req, res) {
  const merchantId = req.user.id;
  const customer = await prisma.customer.create({
    data: {
      merchantId,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      billingAddress: req.body.billingAddress
    }
  });
  res.json({ customer });
}

async function getOrders(req, res) {
  const merchantId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { merchantId },
      include: { posDevice: true, customer: true, payment: true },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.order.count({ where: { merchantId } })
  ]);

  res.json({ orders, total, page, limit, totalPages: Math.ceil(total / limit) });
}

async function getOrderById(req, res) {
  const merchantId = req.user.id;
  const { id } = req.params;
  const order = await prisma.order.findUnique({
    where: { id, merchantId },
    include: { posDevice: true, customer: true, payment: true }
  });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json({ order });
}

async function createOrder(req, res) {
  try {
    const merchantId = req.user.id;
    const { posId, customerId, amount, currency, description } = req.body;
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

async function completeOrder(req, res) {
  const merchantId = req.user.id;
  const { id } = req.params;
  const { paymentIntentId } = req.body;

  await PaymentService.capturePayment(paymentIntentId);
  const order = await prisma.order.update({
    where: { id, merchantId },
    data: { status: 'completed' },
    include: { payment: true }
  });
  res.json({ order });
}

async function cancelOrder(req, res) {
  const merchantId = req.user.id;
  const { id } = req.params;
  const order = await prisma.order.update({
    where: { id, merchantId },
    data: { status: 'canceled' }
  });
  res.json({ order });
}

async function getTransactions(req, res) {
  const merchantId = req.user.id;
  const transactions = await prisma.transaction.findMany({
    where: { merchantId },
    include: { posDevice: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ transactions });
}

async function getNotifications(req, res) {
  const merchantId = req.user.id;
  const notifications = await prisma.merchantNotification.findMany({
    where: { merchantId },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ notifications });
}

async function markNotificationRead(req, res) {
  const merchantId = req.user.id;
  const { id } = req.params;
  await prisma.merchantNotification.update({
    where: { id, merchantId },
    data: { read: true }
  });
  res.json({ success: true });
}

async function getVerificationRequests(req, res) {
  const merchantId = req.user.id;
  const requests = await prisma.customerVerification.findMany({
    where: { merchantId },
    include: { customer: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ verificationRequests: requests });
}

async function submitVerificationRequest(req, res) {
  const merchantId = req.user.id;
  const { id } = req.params;
  const { documents, notes } = req.body;
  const request = await prisma.customerVerification.create({
    data: {
      customerId: id,
      merchantId,
      documentUrls: JSON.stringify(documents),
      notes
    },
    include: { customer: true }
  });
  // Create an admin notification
  await prisma.adminNotification.create({
    data: {
      type: 'NEW_VERIFICATION_REQUEST',
      title: 'New Customer Verification Request',
      message: `${req.user.businessName} submitted a verification request for customer ${request.customer.name}`,
      data: JSON.stringify({ verificationId: request.id })
    }
  });
  res.json({ verificationId: request.id });
}

async function getChatMessages(req, res) {
  const merchantId = req.user.id;
  const messages = await prisma.chatMessage.findMany({
    where: { merchantId },
    orderBy: { createdAt: 'asc' }
  });
  res.json(messages);
}

async function sendChatMessage(req, res) {
  const merchantId = req.user.id;
  const { message } = req.body;
  const chat = await prisma.chatMessage.create({
    data: { merchantId, sender: 'merchant', message }
  });
  await prisma.adminNotification.create({
    data: {
      type: 'NEW_MESSAGE',
      title: 'New Support Message',
      message: `${req.user.businessName} sent a message`,
      data: JSON.stringify({ merchantId })
    }
  });
  res.json(chat);
}

module.exports = {
  merchantLogin,
  getMerchantDashboard,
  getPOSDevices,
  createPOSDevice,
  getCustomers,
  createCustomer,
  getOrders,
  getOrderById,
  createOrder,
  completeOrder,
  cancelOrder,
  getTransactions,
  getNotifications,
  markNotificationRead,
  getVerificationRequests,
  submitVerificationRequest,
  getChatMessages,
  sendChatMessage
};
