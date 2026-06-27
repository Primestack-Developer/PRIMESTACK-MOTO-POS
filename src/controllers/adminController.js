const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const stripe = require('../config/stripe');
const MerchantService = require('../services/merchantService');

async function adminLogin(req, res) {
  const { email, password } = req.body;
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { id: admin.id, email: admin.email, type: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
}

async function getDashboardStats(req, res) {
  const [totalMerchants, totalDevices, totalTransactions, todayTransactions] = await Promise.all([
    prisma.merchant.count(),
    prisma.pOSDevice.count(),
    prisma.transaction.count(),
    prisma.transaction.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    })
  ]);
  res.json({
    totalMerchants,
    totalDevices,
    totalTransactions,
    todayTransactions
  });
}

async function getMerchants(req, res) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const search = req.query.search || '';
  const skip = (page - 1) * limit;

  const where = search ? {
    OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { businessName: { contains: search, mode: 'insensitive' } }
    ]
  } : {};

  const [merchants, total] = await Promise.all([
    prisma.merchant.findMany({
      where,
      skip,
      take: limit,
      include: { posDevices: true, notifications: true },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.merchant.count({ where })
  ]);

  res.json({ merchants, total, page, limit, totalPages: Math.ceil(total / limit) });
}

async function createMerchant(req, res) {
  try {
    const merchant = await MerchantService.registerMerchant(req.body);
    res.json({ success: true, merchant });
  } catch (error) {
    logger.error('Failed to create merchant', { error: error.message });
    res.status(500).json({ error: error.message });
  }
}

async function getMerchantById(req, res) {
  const { id } = req.params;
  const merchant = await prisma.merchant.findUnique({
    where: { id },
    include: { posDevices: true, customers: true, orders: true, notifications: true }
  });
  if (!merchant) {
    return res.status(404).json({ error: 'Merchant not found' });
  }
  res.json({ merchant });
}

async function getPOSDevices(req, res) {
  const posDevices = await prisma.pOSDevice.findMany({
    include: { merchant: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ posDevices });
}

async function getOrders(req, res) {
  const orders = await prisma.order.findMany({
    include: { merchant: true, posDevice: true, customer: true, payment: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ orders });
}

async function getTransactions(req, res) {
  const transactions = await prisma.transaction.findMany({
    include: { merchant: true, posDevice: true, refunds: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ transactions });
}

async function getWebhookLogs(req, res) {
  const webhookLogs = await prisma.webhookLog.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json({ webhookLogs });
}

async function getFraudFlags(req, res) {
  const fraudFlags = await prisma.fraudFlag.findMany({
    include: { merchant: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ fraudFlags });
}

async function getDisputes(req, res) {
  const disputes = await prisma.dispute.findMany({
    include: { merchant: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ disputes });
}

async function updateMerchantStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const merchant = await prisma.merchant.update({
    where: { id },
    data: { status }
  });
  res.json({ merchant });
}

async function resetMerchantPassword(req, res) {
  const { id } = req.params;
  const tempPassword = Math.random().toString(36).substring(2, 10);
  const hashedPassword = await bcrypt.hash(tempPassword, 10);
  await prisma.merchant.update({
    where: { id },
    data: { password: hashedPassword }
  });
  res.json({ tempPassword });
}

async function deleteMerchant(req, res) {
  const { id } = req.params;
  await prisma.merchant.delete({
    where: { id }
  });
  res.json({ message: 'Merchant deleted successfully' });
}

async function createPOSDevice(req, res) {
  try {
    const { merchantId } = req.params;
    const device = await MerchantService.createPOSDevice(merchantId, null, null);
    res.json({ posId: device.posId, activationCode: device.activationCode });
  } catch (error) {
    logger.error('Failed to create POS device from admin', { error: error.message });
    res.status(500).json({ error: error.message });
  }
}

async function updatePOSDeviceStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const device = await prisma.pOSDevice.update({
    where: { id },
    data: { status }
  });
  res.json({ posId: device.posId });
}

async function markAllNotificationsRead(req, res) {
  await prisma.adminNotification.updateMany({
    where: { read: false },
    data: { read: true }
  });
  res.json({ success: true });
}

async function exportCSV(req, res) {
  const { type } = req.query;
  let data, headers;

  if (type === 'merchants') {
    data = await prisma.merchant.findMany();
    headers = ['ID', 'Name', 'Email', 'Phone', 'Business Name', 'Status', 'Created'];
  } else if (type === 'orders') {
    data = await prisma.order.findMany({ include: { merchant: true } });
    headers = ['Order ID', 'Merchant', 'Amount', 'Currency', 'Status', 'Created'];
  } else if (type === 'transactions') {
    data = await prisma.transaction.findMany({ include: { merchant: true } });
    headers = ['Transaction ID', 'Merchant', 'Amount', 'Currency', 'Status', 'Created'];
  } else {
    return res.status(400).json({ error: 'Invalid export type' });
  }

  let csv = headers.join(',') + '\n';
  data.forEach(item => {
    if (type === 'merchants') {
      csv += `${item.id},${item.name},${item.email},${item.phone},${item.businessName},${item.status},${item.createdAt}\n`;
    } else if (type === 'orders') {
      csv += `${item.orderId},${item.merchant.name},${item.amount},${item.currency},${item.status},${item.createdAt}\n`;
    } else if (type === 'transactions') {
      csv += `${item.id},${item.merchant.businessName},${item.amount},${item.currency},${item.status},${item.createdAt}\n`;
    }
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${type}.csv`);
  res.send(csv);
}

async function createSystemAnnouncement(req, res) {
  const { title, message } = req.body;
  const announcement = await prisma.adminNotification.create({
    data: { type: 'SYSTEM_ANNOUNCEMENT', title, message }
  });
  const merchants = await prisma.merchant.findMany();
  for (const merchant of merchants) {
    await prisma.merchantNotification.create({
      data: {
        merchantId: merchant.id,
        type: 'SYSTEM_ANNOUNCEMENT',
        title,
        message
      }
    });
  }
  res.json({ success: true, announcement });
}

async function getSystemAnnouncements(req, res) {
  const announcements = await prisma.adminNotification.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json({ announcements });
}

async function getAdminNotifications(req, res) {
  const notifications = await prisma.adminNotification.findMany({
    where: { read: false },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ notifications });
}

async function markNotificationRead(req, res) {
  const { id } = req.params;
  await prisma.adminNotification.update({
    where: { id },
    data: { read: true }
  });
  res.json({ success: true });
}

async function getSystemStatus(req, res) {
  const status = await prisma.systemStatus.findFirst({ orderBy: { createdAt: 'desc' } });
  res.json(status || { online: true, message: 'System is operational' });
}

async function updateSystemStatus(req, res) {
  const { online, message } = req.body;
  const status = await prisma.systemStatus.create({
    data: { online, message, updatedBy: req.user.id }
  });
  if (!online) {
    await prisma.adminNotification.create({
      data: {
        type: 'SYSTEM_ALERT',
        title: 'System Status Updated',
        message: message || 'System is offline'
      }
    });
  }
  res.json(status);
}

async function getChatMessages(req, res) {
  const { merchantId } = req.params;
  const messages = await prisma.chatMessage.findMany({
    where: { merchantId },
    orderBy: { createdAt: 'asc' }
  });
  res.json({ messages });
}

async function sendChatMessage(req, res) {
  const { merchantId } = req.params;
  const { message } = req.body;
  const chat = await prisma.chatMessage.create({
    data: { merchantId, sender: 'admin', message }
  });
  res.json({ chat });
}

async function getMerchantsForChat(req, res) {
  const merchants = await prisma.merchant.findMany({
    select: {
      id: true,
      merchantId: true,
      businessName: true,
      email: true,
      chatMessages: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });
  res.json({ conversations: merchants });
}

async function getVerifications(req, res) {
  const verifications = await prisma.customerVerification.findMany({
    include: { customer: true, merchant: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ verifications });
}

async function reviewVerification(req, res) {
  const { id } = req.params;
  const { action, notes } = req.body;
  const status = action === 'approve' ? 'approved' : 'rejected';
  
  const verification = await prisma.customerVerification.update({
    where: { id },
    data: { 
      status,
      notes,
      reviewedBy: req.user.id,
      reviewedAt: new Date() 
    },
    include: { customer: true, merchant: true }
  });
  
  // Create notification for the merchant
  await prisma.merchantNotification.create({
    data: {
      merchantId: verification.merchantId,
      type: `verification_${status}`,
      title: `Customer Verification ${status}`,
      message: `Customer ${verification.customer.name}'s verification has been ${status}`
    }
  });
  
  res.json({ message: `Verification ${status} successfully!` });
}

module.exports = {
  adminLogin,
  getDashboardStats,
  getMerchants,
  createMerchant,
  getMerchantById,
  getPOSDevices,
  getOrders,
  getTransactions,
  getWebhookLogs,
  getFraudFlags,
  getDisputes,
  updateMerchantStatus,
  resetMerchantPassword,
  deleteMerchant,
  createPOSDevice,
  updatePOSDeviceStatus,
  markAllNotificationsRead,
  exportCSV,
  createSystemAnnouncement,
  getSystemAnnouncements,
  getAdminNotifications,
  markNotificationRead,
  getSystemStatus,
  updateSystemStatus,
  getChatMessages,
  sendChatMessage,
  getMerchantsForChat,
  getVerifications,
  reviewVerification
};
