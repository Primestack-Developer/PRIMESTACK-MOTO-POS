const express = require('express');
const router = express.Router();
const {
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
  getMerchantsForChat
} = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.post('/login', adminLogin);
router.get('/dashboard/stats', authenticateToken, requireAdmin, getDashboardStats);
router.get('/merchants', authenticateToken, requireAdmin, getMerchants);
router.post('/merchants', authenticateToken, requireAdmin, createMerchant);
router.get('/merchants/:id', authenticateToken, requireAdmin, getMerchantById);
router.post('/merchants/:id/status', authenticateToken, requireAdmin, updateMerchantStatus);
router.post('/merchants/:id/reset-password', authenticateToken, requireAdmin, resetMerchantPassword);
router.delete('/merchants/:id', authenticateToken, requireAdmin, deleteMerchant);
router.post('/merchants/:merchantId/pos-devices', authenticateToken, requireAdmin, createPOSDevice);
router.get('/pos-devices', authenticateToken, requireAdmin, getPOSDevices);
router.post('/pos-devices/:id/status', authenticateToken, requireAdmin, updatePOSDeviceStatus);
router.get('/orders', authenticateToken, requireAdmin, getOrders);
router.get('/transactions', authenticateToken, requireAdmin, getTransactions);
router.get('/webhook-logs', authenticateToken, requireAdmin, getWebhookLogs);
router.get('/fraud-flags', authenticateToken, requireAdmin, getFraudFlags);
router.get('/disputes', authenticateToken, requireAdmin, getDisputes);
router.get('/export', authenticateToken, requireAdmin, exportCSV);
router.post('/announcements', authenticateToken, requireAdmin, createSystemAnnouncement);
router.get('/announcements', authenticateToken, requireAdmin, getSystemAnnouncements);
router.get('/notifications', authenticateToken, requireAdmin, getAdminNotifications);
router.put('/notifications/:id/read', authenticateToken, requireAdmin, markNotificationRead);
router.post('/notifications/read-all', authenticateToken, requireAdmin, markAllNotificationsRead);
router.get('/system/status', authenticateToken, requireAdmin, getSystemStatus);
router.put('/system/status', authenticateToken, requireAdmin, updateSystemStatus);
router.get('/chat/:merchantId', authenticateToken, requireAdmin, getChatMessages);
router.post('/chat/:merchantId', authenticateToken, requireAdmin, sendChatMessage);
router.get('/chat/merchants/list', authenticateToken, requireAdmin, getMerchantsForChat);

module.exports = router;
