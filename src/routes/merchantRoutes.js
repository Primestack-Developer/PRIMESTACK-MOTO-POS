const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/merchantController');
const { authenticateToken, requireMerchant } = require('../middleware/auth');

router.post('/login', merchantLogin);
router.get('/dashboard', authenticateToken, requireMerchant, getMerchantDashboard);
router.get('/pos-devices', authenticateToken, requireMerchant, getPOSDevices);
router.post('/pos-devices', authenticateToken, requireMerchant, createPOSDevice);
router.get('/customers', authenticateToken, requireMerchant, getCustomers);
router.post('/customers', authenticateToken, requireMerchant, createCustomer);
router.get('/orders', authenticateToken, requireMerchant, getOrders);
router.get('/orders/:id', authenticateToken, requireMerchant, getOrderById);
router.post('/orders', authenticateToken, requireMerchant, createOrder);
router.put('/orders/:id/complete', authenticateToken, requireMerchant, completeOrder);
router.put('/orders/:id/cancel', authenticateToken, requireMerchant, cancelOrder);
router.get('/transactions', authenticateToken, requireMerchant, getTransactions);
router.get('/notifications', authenticateToken, requireMerchant, getNotifications);
router.put('/notifications/:id/read', authenticateToken, requireMerchant, markNotificationRead);
router.get('/verification-requests', authenticateToken, requireMerchant, getVerificationRequests);
router.post('/verification-requests', authenticateToken, requireMerchant, submitVerificationRequest);
router.get('/chat', authenticateToken, requireMerchant, getChatMessages);
router.post('/chat', authenticateToken, requireMerchant, sendChatMessage);

module.exports = router;
