const express = require('express');
const router = express.Router();
const {
  posLogin,
  getPOSInfo,
  createOrder,
  processMotoPayment,
  getOrders,
  getOrderById,
  getCustomers,
  createCustomer,
  completeOrder
} = require('../controllers/posController');
const { authenticateToken, requirePOS } = require('../middleware/auth');

router.post('/login', posLogin);
router.get('/info', authenticateToken, requirePOS, getPOSInfo);
router.post('/orders', authenticateToken, requirePOS, createOrder);
router.post('/moto-payment', authenticateToken, requirePOS, processMotoPayment);
router.get('/orders', authenticateToken, requirePOS, getOrders);
router.get('/orders/:id', authenticateToken, requirePOS, getOrderById);
router.get('/customers', authenticateToken, requirePOS, getCustomers);
router.post('/customers', authenticateToken, requirePOS, createCustomer);
router.put('/orders/:id/complete', authenticateToken, requirePOS, completeOrder);

module.exports = router;
