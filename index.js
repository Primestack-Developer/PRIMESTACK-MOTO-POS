require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Stripe = require('stripe');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const PaymentService = require('./src/services/paymentService');

const prisma = new PrismaClient();
const app = express();
const router = express.Router();

// ─── Validation Helper ────────────────────────────────────────────────────────

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    return res.status(400).json({ error: errors.join(', ') });
  }
  req.body = result.data; // use parsed + coerced data
  next();
};

// ─── Validation Schemas ───────────────────────────────────────────────────────

const schemas = {
  adminRegister: z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(1, 'Name is required').max(100)
  }),
  adminLogin: z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(1, 'Password is required')
  }),
  createMerchant: z.object({
    name: z.string().min(1, 'Name is required').max(100),
    email: z.string().email('Invalid email'),
    phone: z.string().min(5, 'Phone is required').max(30),
    address: z.string().min(1, 'Address is required').max(200),
    country: z.string().min(1, 'Country is required').max(100),
    businessName: z.string().max(100).optional()
  }),
  merchantStatus: z.object({
    status: z.enum(['active', 'suspended'], { errorMap: () => ({ message: 'Status must be active or suspended' }) })
  }),
  posStatus: z.object({
    status: z.enum(['active', 'disabled'], { errorMap: () => ({ message: 'Status must be active or disabled' }) })
  }),
  merchantLogin: z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(1, 'Password is required')
  }),
  updateProfile: z.object({
    name: z.string().min(1).max(100).optional(),
    businessName: z.string().min(1).max(100).optional(),
    phone: z.string().min(5).max(30).optional(),
    address: z.string().min(1).max(200).optional(),
    country: z.string().min(1).max(100).optional()
  }),
  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters')
  }),
  createCustomer: z.object({
    name: z.string().min(1, 'Name is required').max(100),
    email: z.string().email('Invalid email').optional().or(z.literal('')).transform(v => v || null),
    phone: z.string().max(30).optional().or(z.literal('')).transform(v => v || null),
    billingAddress: z.string().max(200).optional().or(z.literal('')).transform(v => v || null),
    documents: z.array(z.object({
      name: z.string().min(1).max(255),
      type: z.string().min(1).max(100),
      base64: z.string().min(1)
    })).optional().default([]),
    notes: z.string().max(1000).optional().or(z.literal('')).transform(v => v || null)
  }),
  activatePOS: z.object({
    activation_code: z.string().min(9, 'Activation code must be in format XXXX-XXXX').max(9),
    device_info: z.object({
      model: z.string().max(100).optional(),
      serial: z.string().max(100).optional(),
      os: z.string().max(100).optional()
    }).optional()
  }),
  createMotoOrder: z.object({
    amount: z.number({ invalid_type_error: 'Amount must be a number' })
      .int('Amount must be in cents (integer)')
      .positive('Amount must be positive')
      .max(1000000, 'Maximum transaction amount is $10,000.00'),
    currency: z.string().length(3, 'Currency must be a 3-letter code').optional().default('usd'),
    description: z.string().max(500).optional(),
    customer_id: z.string().optional().nullable(),
    customer_name: z.string().max(200).optional().nullable()
  }),
  processMotoPayment: z.object({
    cardNumber: z.string().min(12, 'Card number is required').max(25, 'Card number is invalid'),
    cardExpiry: z.string().regex(/^\d{2}\/\d{2,4}$/, 'Expiry must be in MM/YY format'),
    cardCvc: z.string().min(3, 'CVC is required').max(4, 'CVC is invalid'),
    cardholderName: z.string().min(2, 'Cardholder name is required').max(200),
    amount: z.number({ invalid_type_error: 'Amount must be a number' })
      .positive('Amount must be positive')
      .max(10000, 'Maximum transaction amount is $10,000.00'),
    currency: z.string().length(3, 'Currency must be a 3-letter code').optional().default('USD'),
    customerId: z.string().optional().nullable(),
    description: z.string().max(500).optional().nullable()
  }),
  createTransaction: z.object({
    amount: z.number({ invalid_type_error: 'Amount must be a number' }).positive(),
    currency: z.string().length(3).optional().default('USD'),
    customer_email: z.string().email().optional().nullable()
  }),
  submitVerification: z.object({
    documents: z.array(z.object({
      name: z.string().min(1),
      type: z.string().min(1),
      base64: z.string().min(1)
    })).min(1, 'At least one document is required'),
    notes: z.string().max(1000).optional()
  }),
  reviewVerification: z.object({
    action: z.enum(['approved','rejected'], { errorMap: () => ({ message: 'Action must be approved or rejected' }) }),
    notes: z.string().max(1000).optional()
  })
};

// ─── Rate Limiters ────────────────────────────────────────────────────────────

// Strict limiter for login endpoints — 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

// POS activation — 5 attempts per 15 minutes per IP (prevents code brute-force)
const activationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many activation attempts. Please try again in 15 minutes.' }
});

// General API limiter — 200 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});

// ─── Stripe (lazy init) ───────────────────────────────────────────────────────

// Stripe is initialized lazily — server starts even without a real key
let stripe = null;
const getStripe = () => {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key.startsWith('sk_test_your')) {
      throw new Error('STRIPE_SECRET_KEY is not configured. Set a real key in .env to use payment features.');
    }
    stripe = new Stripe(key);
  }
  return stripe;
};

// ─── Security Middleware (TEMPORARILY DISABLED TO FIX 403 ERRORS) ─────────────

// 1. Raw body for Stripe webhooks (still needed)
router.use('/webhooks/stripe', express.raw({ type: 'application/json' }))
router.use('/stripe/webhook',  express.raw({ type: 'application/json' }))

// 2. Body parser (still needed)
router.use(express.json({ limit: '20mb' }))

// ─── Auth Middleware ───────────────────────────────────────────────────────────

// Track failed login attempts per IP
const loginAttempts = new Map()
const MAX_ATTEMPTS = 5
const BLOCK_TIME   = 15 * 60 * 1000 // 15 min

const checkBruteForce = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress
  const record = loginAttempts.get(ip)
  if (record && record.blocked && Date.now() < record.blockedUntil) {
    const mins = Math.ceil((record.blockedUntil - Date.now()) / 60000)
    return res.status(429).json({ error: `Too many failed attempts. Try again in ${mins} minute(s).` })
  }
  next()
}

const recordFailedLogin = (ip) => {
  const record = loginAttempts.get(ip) || { count: 0, blocked: false }
  record.count++
  if (record.count >= MAX_ATTEMPTS) {
    record.blocked = true
    record.blockedUntil = Date.now() + BLOCK_TIME
    record.count = 0
  }
  loginAttempts.set(ip, record)
}

const clearLoginAttempts = (ip) => {
  loginAttempts.delete(ip)
}

// Clean up old entries every 30 min
setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of loginAttempts.entries()) {
    if (record.blocked && now > record.blockedUntil) loginAttempts.delete(ip)
  }
}, 30 * 60 * 1000)

const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Authorization header missing' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const authenticateMerchant = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Authorization header missing' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'merchant') return res.status(403).json({ error: 'Merchant access required' });
    req.merchant = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const authenticatePOS = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Authorization header missing' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'pos') return res.status(403).json({ error: 'POS access required' });
    // Check device is still active AND merchant is not suspended before allowing any POS action
    prisma.pOSDevice.findUnique({ 
      where: { id: decoded.id }, 
      include: { merchant: true } 
    }).then(device => {
      if (!device || device.status === 'disabled') {
        return res.status(403).json({ error: 'POS device is disabled' });
      }
      if (device.merchant.status === 'suspended') {
        return res.status(403).json({ error: 'Merchant account is suspended' });
      }
      req.pos = decoded;
      next();
    }).catch(() => res.status(500).json({ error: 'Failed to verify device/merchant status' }));
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

const generateMerchantId = () => `M${Math.floor(100000 + Math.random() * 900000)}`;

const generatePosId = async () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `PS-${timestamp}-${random}`;
};

const generateActivationCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg()}-${seg()}`;
};

const createPosDevice = async (merchantId) => {
  let lastError;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const posId = await generatePosId();
      const activationCode = generateActivationCode();
      return await prisma.pOSDevice.create({
        data: { posId, merchantId, activationCode, status: 'pending' }
      });
    } catch (error) {
      lastError = error;
      const isUniqueConstraintError = error?.code === 'P2002' || /Unique constraint failed/i.test(error?.message || '');
      if (!isUniqueConstraintError) throw error;
    }
  }

  throw lastError;
};

const generateOrderId = async () => {
  const recentOrders = await prisma.order.findMany({
    where: { orderId: { startsWith: 'ORD-' } },
    orderBy: { orderId: 'desc' },
    select: { orderId: true },
    take: 50
  });
  const lastOrder = recentOrders.find(order => /^ORD-\d+$/.test(order.orderId));
  const lastNumber = Number.parseInt(lastOrder?.orderId?.replace('ORD-', '') || '0', 10);
  const nextNumber = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;
  return `ORD-${String(nextNumber).padStart(6, '0')}`;
};

const isUniqueConstraintError = (error) =>
  error?.code === 'P2002' || /Unique constraint failed/i.test(error?.message || '');

const createOrderWithUniqueId = async (data) => {
  let lastError;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const orderId = await generateOrderId();
      return await prisma.order.create({ data: { ...data, orderId } });
    } catch (error) {
      lastError = error;
      if (!isUniqueConstraintError(error)) throw error;
    }
  }

  const fallbackOrderId = `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  return prisma.order.create({ data: { ...data, orderId: fallbackOrderId } });
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// ─── Shared Webhook Handler ───────────────────────────────────────────────────

async function handleStripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const webhookObject = event.data.object;
    const webhookOrderId = webhookObject?.metadata?.order_id || webhookObject?.metadata?.orderId || null;
    let enrichedWebhookPayload = webhookObject;

    if (webhookOrderId) {
      const webhookOrder = await prisma.order.findUnique({
        where: { orderId: webhookOrderId },
        include: { merchant: true }
      });
      if (webhookOrder) {
        enrichedWebhookPayload = {
          ...webhookObject,
          dashboard_order_id: webhookOrder.orderId,
          dashboard_merchant_id: webhookOrder.merchant?.merchantId || webhookOrder.merchantId,
          dashboard_merchant_name: webhookOrder.merchant?.businessName || webhookOrder.merchant?.name || 'Unknown Merchant',
          dashboard_received_at: new Date().toISOString()
        };
      }
    }

    await prisma.webhookLog.create({
      data: { eventType: event.type, payload: JSON.stringify(enrichedWebhookPayload) }
    });

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const orderId = pi.metadata?.order_id;
      if (!orderId) return res.json({ received: true });

      const order = await prisma.order.findUnique({ where: { orderId } });
      if (!order) return res.json({ received: true });

      const charge = typeof pi.latest_charge === 'string'
        ? await getStripe().charges.retrieve(pi.latest_charge)
        : pi.latest_charge || pi.charges?.data?.[0];
      const billingName = (charge?.billing_details?.name || '').trim().toLowerCase();
      const expectedName = (order.expectedCardholder || pi.metadata?.expected_cardholder || '').trim().toLowerCase();

      // Option B: Name mismatch — auto-refund and flag
      if (expectedName && billingName && billingName !== expectedName) {
        console.log(`Name mismatch on order ${orderId}: expected "${expectedName}", got "${billingName}"`);

        // Issue automatic refund
        try {
          await getStripe().refunds.create({
            payment_intent: pi.id,
            reason: 'fraudulent',
            metadata: { reason: 'cardholder_name_mismatch', order_id: orderId, expected: expectedName, provided: billingName }
          });
        } catch (refundErr) {
          console.error('Refund failed:', refundErr.message);
        }

        // Mark order as flagged
        await prisma.order.update({ where: { orderId }, data: { status: 'flagged' } });

        // Notify merchant
        await prisma.merchantNotification.create({
          data: {
            merchantId: order.merchantId,
            type: 'payment_flagged',
            title: 'Payment Blocked — Name Mismatch',
            message: `Order ${orderId} was automatically refunded. Cardholder name "${charge?.billing_details?.name || 'unknown'}" did not match registered customer "${order.expectedCardholder || 'unknown'}".`
          }
        });

        // Notify admin
        await prisma.adminNotification.create({
          data: {
            type: 'payment_flagged',
            title: 'Payment Flagged — Name Mismatch',
            message: `Order ${orderId} was auto-refunded. Expected: "${order.expectedCardholder}", Got: "${charge?.billing_details?.name || 'unknown'}".`,
            data: JSON.stringify({ orderId, merchantId: order.merchantId })
          }
        });

        await prisma.deviceLog.create({
          data: { posId: order.posId, merchantId: order.merchantId, action: 'payment_flagged_name_mismatch', details: JSON.stringify({ orderId, expected: expectedName, provided: billingName }) }
        });

        console.log(`Order ${orderId} flagged and refunded — name mismatch`);
        return res.json({ received: true });
      }

      // Names match (or no expected name set) — normal success flow
      await prisma.order.update({ where: { orderId }, data: { status: 'paid', paymentIntentId: pi.id } });

      await prisma.payment.upsert({
        where: { orderId: order.id },
        update: {
          stripeChargeId: charge?.id,
          cardBrand: charge?.payment_method_details?.card?.brand,
          cardLast4: charge?.payment_method_details?.card?.last4,
          cardholderName: charge?.billing_details?.name,
          riskLevel: charge?.outcome?.risk_level,
          receiptUrl: charge?.receipt_url,
          status: 'succeeded'
        },
        create: {
          orderId: order.id,
          merchantId: order.merchantId,
          posId: order.posId,
          stripeChargeId: charge?.id,
          cardBrand: charge?.payment_method_details?.card?.brand,
          cardLast4: charge?.payment_method_details?.card?.last4,
          cardholderName: charge?.billing_details?.name,
          riskLevel: charge?.outcome?.risk_level,
          receiptUrl: charge?.receipt_url,
          status: 'succeeded'
        }
      });

      await prisma.deviceLog.create({
        data: { posId: order.posId, merchantId: order.merchantId, action: 'payment_succeeded', details: JSON.stringify({ orderId }) }
      });

      // ── Always notify admin with full payment details including name check ──
      const cardholderName = charge?.billing_details?.name || 'Not provided'
      const expectedCardholder = order.expectedCardholder || 'Walk-in'
      const nameMatch = !order.expectedCardholder || cardholderName.toLowerCase() === expectedCardholder.toLowerCase()

      await prisma.adminNotification.create({
        data: {
          type: nameMatch ? 'payment_succeeded' : 'payment_name_warning',
          title: nameMatch ? `✅ Payment ${order.currency} ${order.amount.toFixed(2)}` : `⚠️ Payment — NAME MISMATCH ALERT`,
          message: nameMatch
            ? `Order ${orderId} | $${order.amount.toFixed(2)} | Cardholder: ${cardholderName} | Customer: ${expectedCardholder} | Merchant: ${order.merchantId}`
            : `Order ${orderId} | $${order.amount.toFixed(2)} | Expected: "${expectedCardholder}" | Got: "${cardholderName}" | Payment went through — review and refund if fraudulent`,
          data: JSON.stringify({ orderId, merchantId: order.merchantId, amount: order.amount, cardholderName, expectedCardholder, nameMatch })
        }
      });

      // ── Post-payment: disable ALL merchant POS devices for re-verification ──
      if (order.customerId) {
        await prisma.pOSDevice.updateMany({
          where: { merchantId: order.merchantId, status: 'active' },
          data: { status: 'disabled' }
        });

        await prisma.customerVerification.upsert({
          where: { customerId: order.customerId },
          update: { status: 'pending', documentUrls: '[]', reviewedBy: null, reviewedAt: null },
          create: { customerId: order.customerId, merchantId: order.merchantId, status: 'pending', documentUrls: '[]' }
        });

        await prisma.merchantNotification.create({
          data: {
            merchantId: order.merchantId,
            type: 'pos_disabled_post_payment',
            title: 'POS Paused — Re-verification Required',
            message: `Payment ${orderId} completed successfully. Your POS devices have been paused. Please re-submit customer documents to continue processing payments.`
          }
        });

        // Notify admin of successful payment
        await prisma.adminNotification.create({
          data: {
            type: 'payment_succeeded',
            title: 'Payment Completed',
            message: `Order ${orderId} paid successfully. Amount: ${order.currency} ${order.amount.toFixed(2)}. POS paused pending re-verification.`,
            data: JSON.stringify({ orderId, merchantId: order.merchantId, amount: order.amount })
          }
        });

        console.log(`Order ${orderId} paid — POS disabled for re-verification`);
      } else {
        // Walk-in payment — notify admin without disabling POS
        await prisma.adminNotification.create({
          data: {
            type: 'payment_succeeded',
            title: 'Payment Completed (Walk-in)',
            message: `Order ${orderId} paid successfully. Amount: ${order.currency} ${order.amount.toFixed(2)}.`,
            data: JSON.stringify({ orderId, merchantId: order.merchantId, amount: order.amount })
          }
        });
      }

      console.log(`Order ${orderId} marked as paid`);
    } else if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object;
      const orderId = pi.metadata?.order_id;
      if (!orderId) return res.json({ received: true });

      const order = await prisma.order.findUnique({ where: { orderId } });
      if (!order) return res.json({ received: true });

      await prisma.order.update({ where: { orderId }, data: { status: 'failed' } });

      await prisma.deviceLog.create({
        data: { posId: order.posId, merchantId: order.merchantId, action: 'payment_failed', details: JSON.stringify({ orderId }) }
      });

      console.log(`Order ${orderId} marked as failed`);

    } else if (event.type === 'charge.refunded') {
      // ── REFUND PROCESSED (from Stripe dashboard or API) ────────────────────
      const charge = event.data.object;
      const refund = charge.refunds?.data?.[0];
      
      // Find order by charge ID
      const payment = await prisma.payment.findFirst({ where: { stripeChargeId: charge.id } });
      if (!payment) return res.json({ received: true });
      
      const order = await prisma.order.findUnique({ where: { id: payment.orderId } });
      if (!order) return res.json({ received: true });

      // Update order status
      await prisma.order.update({ where: { orderId: order.orderId }, data: { status: 'refunded' } });

      const refundAmount = refund ? (refund.amount / 100).toFixed(2) : order.amount.toFixed(2);
      const refundReason = refund?.reason || 'Manual refund via Stripe Dashboard';

      // Notify admin
      await prisma.adminNotification.create({
        data: {
          type: 'refund_processed',
          title: '💸 Refund Processed',
          message: `Order ${order.orderId} refunded $${refundAmount}. Reason: ${refundReason}. Merchant notified.`,
          data: JSON.stringify({ orderId: order.orderId, merchantId: order.merchantId, amount: refundAmount })
        }
      });

      // Notify merchant with reason
      await prisma.merchantNotification.create({
        data: {
          merchantId: order.merchantId,
          type: 'refund_processed',
          title: '💸 Payment Refunded',
          message: `Order ${order.orderId} ($${refundAmount}) has been refunded. Reason: ${refundReason}. If you have questions, contact admin.`
        }
      });

      console.log(`Refund processed: Order ${order.orderId} | $${refundAmount} | ${refundReason}`);

    } else if (event.type === 'charge.dispute.created') {
      // ── CHARGEBACK RECEIVED ──────────────────────────────────────────────────
      const dispute = event.data.object;
      const chargeId = dispute.charge;

      // Find the order via charge ID
      const payment = await prisma.payment.findFirst({ where: { stripeChargeId: chargeId } });
      if (!payment) { console.log('Dispute: no payment found for charge', chargeId); return res.json({ received: true }); }

      const order = await prisma.order.findUnique({ where: { id: payment.orderId } });
      if (!order) return res.json({ received: true });

      // Calculate risk score
      let riskScore = 50; // base
      if (dispute.reason === 'fraudulent') riskScore = 90;
      else if (dispute.reason === 'credit_not_processed') riskScore = 70;
      else if (dispute.reason === 'duplicate') riskScore = 60;

      const deadline = dispute.evidence_details?.due_by
        ? new Date(dispute.evidence_details.due_by * 1000) : null;

      // Save dispute record
      await prisma.dispute.create({
        data: {
          orderId: order.orderId,
          merchantId: order.merchantId,
          stripeDisputeId: dispute.id,
          stripeChargeId: chargeId,
          amount: dispute.amount / 100,
          currency: (dispute.currency || 'USD').toUpperCase(),
          reason: dispute.reason || 'unknown',
          status: dispute.status,
          evidenceDeadline: deadline,
          riskScore,
          notes: `Stripe reason: ${dispute.reason}. Status: ${dispute.status}`
        }
      });

      // Mark order as disputed
      await prisma.order.update({ where: { orderId: order.orderId }, data: { status: 'disputed' } });

      // Disable ALL merchant POS devices immediately
      await prisma.pOSDevice.updateMany({
        where: { merchantId: order.merchantId, status: 'active' },
        data: { status: 'disabled' }
      });

      // Flag for fraud review
      await prisma.fraudFlag.create({
        data: {
          orderId: order.orderId,
          merchantId: order.merchantId,
          type: 'chargeback',
          details: JSON.stringify({ disputeId: dispute.id, reason: dispute.reason, amount: dispute.amount / 100, deadline: deadline }),
          severity: riskScore >= 80 ? 'high' : riskScore >= 60 ? 'medium' : 'low'
        }
      });

      // Notify admin — URGENT
      await prisma.adminNotification.create({
        data: {
          type: 'dispute_created',
          title: `🚨 CHARGEBACK ALERT — ${dispute.reason?.toUpperCase()}`,
          message: `Order ${order.orderId} | Merchant ID: ${order.merchantId} | Amount: $${(dispute.amount/100).toFixed(2)} | Reason: ${dispute.reason} | Evidence due: ${deadline ? deadline.toLocaleDateString() : 'Unknown'} | Merchant POS auto-disabled.`,
          data: JSON.stringify({ disputeId: dispute.id, orderId: order.orderId, merchantId: order.merchantId, amount: dispute.amount/100, reason: dispute.reason, deadline })
        }
      });

      // Notify merchant
      await prisma.merchantNotification.create({
        data: {
          merchantId: order.merchantId,
          type: 'dispute_created',
          title: '🚨 Chargeback Filed Against Your Account',
          message: `A chargeback has been filed for order ${order.orderId} ($${(dispute.amount/100).toFixed(2)}). Reason: ${dispute.reason}. Your POS devices have been suspended. Contact admin immediately.`
        }
      });

      console.log(`CHARGEBACK: Order ${order.orderId} | Reason: ${dispute.reason} | POS disabled | Admin alerted`);

    } else if (event.type === 'charge.dispute.updated') {
      const dispute = event.data.object;
      const existing = await prisma.dispute.findUnique({ where: { stripeDisputeId: dispute.id } });
      if (existing) {
        await prisma.dispute.update({
          where: { stripeDisputeId: dispute.id },
          data: { status: dispute.status, notes: `Updated status: ${dispute.status}` }
        });
        // Notify admin of status change
        await prisma.adminNotification.create({
          data: {
            type: 'dispute_updated',
            title: `Dispute Updated — ${dispute.status}`,
            message: `Dispute ${dispute.id} for order ${existing.orderId} updated to: ${dispute.status}`,
            data: JSON.stringify({ disputeId: dispute.id, status: dispute.status })
          }
        });
      }

    } else if (event.type === 'charge.dispute.closed') {
      const dispute = event.data.object;
      const existing = await prisma.dispute.findUnique({ where: { stripeDisputeId: dispute.id } });
      if (existing) {
        await prisma.dispute.update({
          where: { stripeDisputeId: dispute.id },
          data: { status: dispute.status }
        });
        // If won, re-enable merchant POS
        if (dispute.status === 'won') {
          await prisma.pOSDevice.updateMany({
            where: { merchantId: existing.merchantId, status: 'disabled' },
            data: { status: 'active' }
          });
          await prisma.adminNotification.create({
            data: {
              type: 'dispute_won',
              title: '✅ Dispute WON',
              message: `Dispute for order ${existing.orderId} was decided in your favour. Merchant POS re-enabled.`,
              data: JSON.stringify({ disputeId: dispute.id })
            }
          });
          await prisma.merchantNotification.create({
            data: {
              merchantId: existing.merchantId,
              type: 'dispute_won',
              title: '✅ Chargeback Won',
              message: `The chargeback dispute for order ${existing.orderId} was decided in your favour. Your POS devices have been re-enabled.`
            }
          });
        } else {
          await prisma.adminNotification.create({
            data: {
              type: 'dispute_lost',
              title: '❌ Dispute LOST',
              message: `Dispute for order ${existing.orderId} was lost. Status: ${dispute.status}. Review merchant account.`,
              data: JSON.stringify({ disputeId: dispute.id, orderId: existing.orderId })
            }
          });
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
}

// ─── Admin Routes ─────────────────────────────────────────────────────────────

router.post('/admin/register', validate(schemas.adminRegister), async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await prisma.admin.create({ data: { email, password: hashedPassword, name } });
    res.json({ message: 'Admin created successfully', admin: { id: admin.id, email: admin.email, name: admin.name } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/login', loginLimiter, checkBruteForce, validate(schemas.adminLogin), async (req, res) => {
  try {
    const { email, password } = req.body
    const ip = req.ip || req.connection.remoteAddress
    const admin = await prisma.admin.findUnique({ where: { email } })
    if (!admin) {
      recordFailedLogin(ip)
      return res.status(404).json({ error: 'Admin not found' })
    }

    // Check if account is locked
    if (admin.lockedUntil && new Date() < admin.lockedUntil) {
      const mins = Math.ceil((admin.lockedUntil - new Date()) / 60000)
      return res.status(423).json({ error: `Account locked. Try again in ${mins} minute(s) or use your Recovery Key.`, locked: true })
    }

    const valid = await bcrypt.compare(password, admin.password)
    if (!valid) {
      const currentFailedLogins = Number(admin.failedLogins) || 0
      const failedLogins = currentFailedLogins + 1
      const lockData = failedLogins >= 10
        ? { failedLogins: 0, lockedUntil: new Date(Date.now() + 60 * 60 * 1000) } // lock 1 hour
        : { failedLogins }
      await prisma.admin.update({ where: { id: admin.id }, data: lockData })
      recordFailedLogin(ip)
      const remaining = 10 - failedLogins
      return res.status(401).json({
        error: failedLogins >= 10
          ? 'Account locked for 1 hour due to too many failed attempts. Use your Recovery Key.'
          : `Invalid password. ${remaining} attempt(s) remaining before lockout.`
      })
    }

    // Success — clear failed attempts
    await prisma.admin.update({ where: { id: admin.id }, data: { failedLogins: 0, lockedUntil: null } })
    clearLoginAttempts(ip)
    const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Recovery key login — bypasses password, clears lockout
router.post('/admin/login/recovery', loginLimiter, async (req, res) => {
  try {
    const { recoveryKey } = req.body
    if (!recoveryKey) return res.status(400).json({ error: 'Recovery key required' })
    const admin = await prisma.admin.findUnique({ where: { recoveryKey } })
    if (!admin) return res.status(401).json({ error: 'Invalid recovery key' })

    // Clear lockout
    await prisma.admin.update({ where: { id: admin.id }, data: { failedLogins: 0, lockedUntil: null } })

    // Generate new recovery key after use (one-time use security)
    const crypto = require('crypto')
    const newKey = 'PS-RK-' + crypto.randomBytes(32).toString('hex').toUpperCase()
    await prisma.admin.update({ where: { id: admin.id }, data: { recoveryKey: newKey } })

    const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' })

    // Notify via admin notification
    await prisma.adminNotification.create({
      data: {
        type: 'recovery_key_used',
        title: '🔑 Recovery Key Used',
        message: `Admin account was accessed using recovery key. A new key has been generated — check your settings to save it.`,
        data: JSON.stringify({ newRecoveryKey: newKey })
      }
    })

    res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name }, newRecoveryKey: newKey })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Change admin password
router.put('/admin/password', authenticateAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' })
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' })
    const admin = await prisma.admin.findUnique({ where: { id: req.admin.id } })
    const valid = await bcrypt.compare(currentPassword, admin.password)
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' })
    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.admin.update({ where: { id: req.admin.id }, data: { password: hashed } })
    res.json({ message: 'Password updated successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Set / verify admin PIN
router.post('/admin/pin/set', authenticateAdmin, async (req, res) => {
  try {
    const { pin, currentPassword } = req.body
    if (!pin || !/^\d{6}$/.test(pin)) return res.status(400).json({ error: 'PIN must be exactly 6 digits' })
    const admin = await prisma.admin.findUnique({ where: { id: req.admin.id } })
    const valid = await bcrypt.compare(currentPassword, admin.password)
    if (!valid) return res.status(401).json({ error: 'Password confirmation required to set PIN' })
    const hashedPin = await bcrypt.hash(pin, 10)
    await prisma.admin.update({ where: { id: req.admin.id }, data: { pin: hashedPin } })
    res.json({ message: 'PIN set successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/admin/pin/verify', authenticateAdmin, async (req, res) => {
  try {
    const { pin } = req.body
    if (!pin) return res.status(400).json({ error: 'PIN required' })
    const admin = await prisma.admin.findUnique({ where: { id: req.admin.id } })
    if (!admin.pin) return res.status(400).json({ error: 'No PIN set' })
    const valid = await bcrypt.compare(pin, admin.pin)
    if (!valid) return res.status(401).json({ error: 'Incorrect PIN' })
    res.json({ valid: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Generate new recovery key (requires PIN confirmation)
router.post('/admin/recovery-key/regenerate', authenticateAdmin, async (req, res) => {
  try {
    const { pin } = req.body
    const admin = await prisma.admin.findUnique({ where: { id: req.admin.id } })
    if (admin.pin) {
      if (!pin) return res.status(400).json({ error: 'PIN required to regenerate recovery key' })
      const valid = await bcrypt.compare(pin, admin.pin)
      if (!valid) return res.status(401).json({ error: 'Incorrect PIN' })
    }
    const crypto = require('crypto')
    const newKey = 'PS-RK-' + crypto.randomBytes(32).toString('hex').toUpperCase()
    await prisma.admin.update({ where: { id: req.admin.id }, data: { recoveryKey: newKey } })
    res.json({ recoveryKey: newKey, message: 'New recovery key generated. Save it immediately.' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/admin/merchants', authenticateAdmin, validate(schemas.createMerchant), async (req, res) => {
  try {
    const { name, email, phone, address, country, businessName } = req.body;
    const password = Math.random().toString(36).substring(2, 10);
    const hashedPassword = await bcrypt.hash(password, 10);
    const merchantId = generateMerchantId();

    const merchant = await prisma.merchant.create({
      data: {
        merchantId,
        name,
        businessName: businessName || name,
        email,
        phone,
        address,
        country,
        status: 'active',
        password: hashedPassword
      }
    });

    res.json({
      merchant_id: merchant.merchantId,
      login_email: merchant.email,
      temp_password: password
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/merchants', authenticateAdmin, async (req, res) => {
  try {
    const merchants = await prisma.merchant.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ merchants });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/merchants/:merchantId/status', authenticateAdmin, validate(schemas.merchantStatus), async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { status } = req.body;
    const merchant = await prisma.merchant.findUnique({ where: { merchantId } });
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });
    
    // Update merchant status
    const updated = await prisma.merchant.update({ where: { merchantId }, data: { status } });
    
    // If suspending, disable all POS devices; if activating, enable them
    if (status === 'suspended') {
      await prisma.pOSDevice.updateMany({
        where: { merchantId: merchant.id },
        data: { status: 'disabled' }
      });
      // Notify merchant
      await prisma.merchantNotification.create({
        data: {
          merchantId: merchant.id,
          type: 'account_suspended',
          title: 'Account Suspended',
          message: 'Your account has been suspended. All POS devices have been disabled. Please contact admin for more information.'
        }
      });
    } else if (status === 'active') {
      await prisma.pOSDevice.updateMany({
        where: { merchantId: merchant.id },
        data: { status: 'active' }
      });
      // Notify merchant
      await prisma.merchantNotification.create({
        data: {
          merchantId: merchant.id,
          type: 'account_reactivated',
          title: 'Account Reactivated',
          message: 'Your account has been reactivated! All POS devices are now enabled.'
        }
      });
    }
    
    res.json({ merchant_id: updated.merchantId, status: updated.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/merchants/:merchantId/reset-password', authenticateAdmin, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const merchant = await prisma.merchant.findUnique({ where: { merchantId } });
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });
    
    const newTempPassword = Math.random().toString(36).substring(2, 10);
    const hashedPassword = await bcrypt.hash(newTempPassword, 10);
    
    await prisma.merchant.update({ 
      where: { merchantId }, 
      data: { password: hashedPassword } 
    });
    
    // Notify merchant
    await prisma.merchantNotification.create({
      data: {
        merchantId: merchant.id,
        type: 'password_reset',
        title: 'Password Reset',
        message: 'Your password has been reset by admin. Please contact admin for your new temporary password.'
      }
    });
    
    res.json({ 
      message: 'Password reset successfully',
      temp_password: newTempPassword 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/merchants/:merchantId/pos-devices', authenticateAdmin, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const merchant = await prisma.merchant.findUnique({ where: { merchantId } });
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    const posDevice = await createPosDevice(merchant.id);

    // Notify merchant
    await prisma.merchantNotification.create({
      data: {
        merchantId: merchant.id,
        type: 'pos_created',
        title: 'New POS Device Added',
        message: `A new POS device has been created! Activation Code: ${posDevice.activationCode}`
      }
    });

    res.json({
      pos_id: posDevice.posId,
      activation_code: posDevice.activationCode,
      status: posDevice.status
    });
  } catch (error) {
    console.error('Create POS device error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/admin/merchants/:merchantId', authenticateAdmin, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const merchant = await prisma.merchant.findUnique({ where: { merchantId } });
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    // Delete all related records
    await prisma.merchantNotification.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.customerVerification.deleteMany({ 
      where: { customer: { merchantId: merchant.id } } 
    });
    await prisma.customer.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.payment.deleteMany({ 
      where: { order: { merchantId: merchant.id } } 
    });
    await prisma.transaction.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.order.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.deviceLog.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.pOSDevice.deleteMany({ where: { merchantId: merchant.id } });
    // ChatMessages will be automatically deleted by cascade from merchant relation
    // Finally delete the merchant
    await prisma.merchant.delete({ where: { merchantId } });

    res.json({ message: 'Merchant deleted successfully' });
  } catch (error) {
    console.error('Delete merchant error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/pos-devices', authenticateAdmin, async (req, res) => {
  try {
    const posDevices = await prisma.pOSDevice.findMany({
      include: { merchant: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ posDevices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/orders', authenticateAdmin, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        merchant: true,
        posDevice: true,
        payment: true,
        customer: {
          include: { verification: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/transactions', authenticateAdmin, async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: { merchant: true, posDevice: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ transactions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/pos-devices/:posId/status', authenticateAdmin, validate(schemas.posStatus), async (req, res) => {
  try {
    const { posId } = req.params;
    const { status } = req.body;
    if (!['active', 'disabled'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active or disabled' });
    }
    const device = await prisma.pOSDevice.findUnique({ where: { posId } });
    if (!device) return res.status(404).json({ error: 'POS device not found' });
    const updated = await prisma.pOSDevice.update({
      where: { posId },
      data: { status }
    });
    await prisma.deviceLog.create({
      data: {
        posId: device.id,
        merchantId: device.merchantId,
        action: status === 'disabled' ? 'device_disabled' : 'device_enabled',
        details: JSON.stringify({ by: 'admin' })
      }
    });
    res.json({ pos_id: updated.posId, status: updated.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/admin/pos-devices/:posId', authenticateAdmin, async (req, res) => {
  try {
    const { posId } = req.params;
    const device = await prisma.pOSDevice.findUnique({ where: { posId } });
    if (!device) return res.status(404).json({ error: 'POS device not found' });

    const linkedRecords = await prisma.pOSDevice.findUnique({
      where: { posId },
      select: { _count: { select: { orders: true, transactions: true } } }
    });
    const hasPaymentHistory = (linkedRecords?._count?.orders || 0) > 0 || (linkedRecords?._count?.transactions || 0) > 0;
    if (hasPaymentHistory) {
      return res.status(400).json({
        error: 'This POS device has payment history. Disable it instead to preserve transaction records.'
      });
    }

    await prisma.pOSDevice.delete({ where: { posId } });
    res.json({ message: 'POS device deleted successfully', pos_id: posId });
  } catch (error) {
    console.error('Delete POS device error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/notifications', authenticateAdmin, async (req, res) => {
  try {
    const notifications = await prisma.adminNotification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/notifications/:id/read', authenticateAdmin, async (req, res) => {
  try {
    await prisma.adminNotification.update({
      where: { id: req.params.id },
      data: { read: true }
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/notifications/read-all', authenticateAdmin, async (req, res) => {
  try {
    await prisma.adminNotification.updateMany({ data: { read: true } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/webhook-logs', authenticateAdmin, async (req, res) => {
  try {
    const webhookLogs = await prisma.webhookLog.findMany({ orderBy: { receivedAt: 'desc' } });
    res.json({ webhookLogs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Merchant Routes ──────────────────────────────────────────────────────────

router.post('/merchant/login', loginLimiter, checkBruteForce, validate(schemas.merchantLogin), async (req, res) => {
  try {
    const { email, password } = req.body
    const ip = req.ip || req.connection.remoteAddress
    const merchant = await prisma.merchant.findUnique({ where: { email } })
    if (!merchant) { recordFailedLogin(ip); return res.status(404).json({ error: 'Merchant not found' }) }
    if (merchant.status === 'suspended') return res.status(403).json({ error: 'Account suspended' })
    const valid = await bcrypt.compare(password, merchant.password)
    if (!valid) { recordFailedLogin(ip); return res.status(401).json({ error: 'Invalid password' }) }
    clearLoginAttempts(ip)
    const token = jwt.sign(
      { id: merchant.id, merchantId: merchant.merchantId, email: merchant.email, role: 'merchant' },
      process.env.JWT_SECRET, { expiresIn: '7d' }
    )
    res.json({
      token,
      merchant: {
        merchantId: merchant.merchantId, name: merchant.name, businessName: merchant.businessName,
        email: merchant.email, phone: merchant.phone, address: merchant.address,
        country: merchant.country, status: merchant.status
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/merchant/pos-devices', authenticateMerchant, async (req, res) => {
  try {
    const posDevice = await createPosDevice(req.merchant.id);
    res.json({ pos_id: posDevice.posId, activation_code: posDevice.activationCode, status: posDevice.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/merchant/pos-devices', authenticateMerchant, async (req, res) => {
  try {
    const posDevices = await prisma.pOSDevice.findMany({
      where: { merchantId: req.merchant.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ posDevices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/merchant/customers', authenticateMerchant, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { merchantId: req.merchant.id },
      include: { verification: true },
      orderBy: { createdAt: 'desc' }
    });
    // #region debug-point C:get-customers-response
    (()=>{const fs=require('fs'),p='.dbg/customer-doc-submit.env';let u='http://127.0.0.1:7777/event',s='customer-doc-submit';try{const e=fs.readFileSync(p,'utf8');u=e.match(/DEBUG_SERVER_URL=(.+)/)?.[1]||u;s=e.match(/DEBUG_SESSION_ID=(.+)/)?.[1]||s}catch{}fetch(u,{method:'POST',body:JSON.stringify({sessionId:s,runId:'pre-fix',hypothesisId:'C',location:'index.js:/merchant/customers:get',msg:'[DEBUG] Returning merchant customers list',data:{customerCount:customers.length,verificationStates:customers.slice(0,5).map(c=>({id:c.id,name:c.name,verificationStatus:c.verification?.status||null}))},ts:Date.now()})}).catch(()=>{})})();
    // #endregion
    res.json({ customers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/merchant/customers', authenticateMerchant, validate(schemas.createCustomer), async (req, res) => {
  try {
    const { name, email, phone, billingAddress, documents = [], notes = null } = req.body;
    // #region debug-point B:create-customer-entry
    (()=>{const fs=require('fs'),p='.dbg/customer-doc-submit.env';let u='http://127.0.0.1:7777/event',s='customer-doc-submit';try{const e=fs.readFileSync(p,'utf8');u=e.match(/DEBUG_SERVER_URL=(.+)/)?.[1]||u;s=e.match(/DEBUG_SESSION_ID=(.+)/)?.[1]||s}catch{}fetch(u,{method:'POST',body:JSON.stringify({sessionId:s,runId:'pre-fix',hypothesisId:'B',location:'index.js:/merchant/customers:post:entry',msg:'[DEBUG] Merchant create customer request received',data:{merchantId:req.merchant.id,customerName:name,documentCount:Array.isArray(documents)?documents.length:-1,noteLength:(notes||'').length},ts:Date.now()})}).catch(()=>{})})();
    // #endregion
    const customer = await prisma.customer.create({
      data: { merchantId: req.merchant.id, name, email: email || null, phone: phone || null, billingAddress: billingAddress || null }
    });

    let verification = null;
    if (Array.isArray(documents) && documents.length > 0) {
      verification = await prisma.customerVerification.create({
        data: {
          customerId: customer.id,
          merchantId: req.merchant.id,
          documentUrls: JSON.stringify(documents),
          notes: notes || null
        }
      });

      await prisma.adminNotification.create({
        data: {
          type: 'verification_submitted',
          title: 'New Customer Verification Request',
          message: `${req.merchant.businessName || req.merchant.email || req.merchant.merchantId} submitted customer verification for "${customer.name}". Documents ready for review.`,
          data: JSON.stringify({ verificationId: verification.id, customerId: customer.id, merchantId: req.merchant.merchantId })
        }
      });
    }

    // #region debug-point B:create-customer-exit
    (()=>{const fs=require('fs'),p='.dbg/customer-doc-submit.env';let u='http://127.0.0.1:7777/event',s='customer-doc-submit';try{const e=fs.readFileSync(p,'utf8');u=e.match(/DEBUG_SERVER_URL=(.+)/)?.[1]||u;s=e.match(/DEBUG_SESSION_ID=(.+)/)?.[1]||s}catch{}fetch(u,{method:'POST',body:JSON.stringify({sessionId:s,runId:'pre-fix',hypothesisId:'B',location:'index.js:/merchant/customers:post:exit',msg:'[DEBUG] Merchant customer create completed',data:{customerId:customer.id,verificationCreated:!!verification,verificationStatus:verification?.status||null},ts:Date.now()})}).catch(()=>{})})();
    // #endregion
    res.json({ customer, verification });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/merchant/orders', authenticateMerchant, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { merchantId: req.merchant.id },
      include: { customer: true, posDevice: true, payment: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/merchant/transactions', authenticateMerchant, async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { merchantId: req.merchant.id },
      include: { posDevice: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ transactions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/merchant/profile', authenticateMerchant, validate(schemas.updateProfile), async (req, res) => {
  try {
    const { name, businessName, phone, address, country } = req.body;
    const updated = await prisma.merchant.update({
      where: { id: req.merchant.id },
      data: {
        ...(name && { name }),
        ...(businessName && { businessName }),
        ...(phone && { phone }),
        ...(address && { address }),
        ...(country && { country })
      }
    });
    res.json({
      merchant: {
        merchantId: updated.merchantId,
        name: updated.name,
        businessName: updated.businessName,
        email: updated.email,
        phone: updated.phone,
        address: updated.address,
        country: updated.country,
        status: updated.status
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/merchant/password', authenticateMerchant, validate(schemas.changePassword), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    const merchant = await prisma.merchant.findUnique({ where: { id: req.merchant.id } });
    const valid = await bcrypt.compare(currentPassword, merchant.password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.merchant.update({ where: { id: req.merchant.id }, data: { password: hashed } });
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POS Routes ───────────────────────────────────────────────────────────────

router.post('/pos/activate', activationLimiter, validate(schemas.activatePOS), async (req, res) => {
  try {
    const { activation_code, device_info } = req.body;
    const posDevice = await prisma.pOSDevice.findUnique({
      where: { activationCode: activation_code },
      include: { merchant: true }
    });
    if (!posDevice) return res.status(404).json({ error: 'Invalid activation code' });

    // If already active, re-issue token (allows re-login with same code)
    if (posDevice.status === 'active' || posDevice.status === 'disabled') {
      const apiToken = jwt.sign(
        { id: posDevice.id, posId: posDevice.posId, merchantId: posDevice.merchantId, role: 'pos' },
        process.env.JWT_SECRET,
        { expiresIn: '365d' }
      );
      return res.json({
        merchant_id: posDevice.merchant.merchantId,
        pos_id: posDevice.posId,
        merchant_name: posDevice.merchant.businessName,
        api_token: apiToken,
        status: posDevice.status
      });
    }

    const apiToken = jwt.sign(
      { id: posDevice.id, posId: posDevice.posId, merchantId: posDevice.merchantId, role: 'pos' },
      process.env.JWT_SECRET,
      { expiresIn: '365d' }
    );

    await prisma.pOSDevice.update({
      where: { id: posDevice.id },
      data: {
        status: 'active',
        deviceModel: device_info?.model || null,
        deviceSerial: device_info?.serial || null,
        lastSeenAt: new Date()
      }
    });

    await prisma.deviceLog.create({
      data: { posId: posDevice.id, merchantId: posDevice.merchantId, action: 'device_activated', details: JSON.stringify(device_info) }
    });

    res.json({
      merchant_id: posDevice.merchant.merchantId,
      pos_id: posDevice.posId,
      merchant_name: posDevice.merchant.businessName,
      api_token: apiToken,
      status: 'active'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/pos/heartbeat', authenticatePOS, async (req, res) => {
  try {
    await prisma.pOSDevice.update({ where: { id: req.pos.id }, data: { lastSeenAt: new Date() } });
    await prisma.deviceLog.create({
      data: { posId: req.pos.id, merchantId: req.pos.merchantId, action: 'heartbeat' }
    });
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/pos/customers', authenticatePOS, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { merchantId: req.pos.merchantId },
      include: { verification: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ customers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/pos/customers', authenticatePOS, validate(schemas.createCustomer), async (req, res) => {
  try {
    const { name, email, phone, billingAddress } = req.body;
    const customer = await prisma.customer.create({
      data: {
        merchantId: req.pos.merchantId,
        name,
        email: email || null,
        phone: phone || null,
        billingAddress: billingAddress || null
      }
    });
    res.json({ customer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/pos/orders', authenticatePOS, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { posId: req.pos.id },
      include: { customer: true, posDevice: true, payment: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/moto-card-entry/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { client_secret: clientSecret } = req.query;
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey) return res.status(500).send('Stripe publishable key is not configured.');
    if (!clientSecret) return res.status(400).send('Missing payment client secret.');

    const order = await prisma.order.findUnique({
      where: { orderId },
      include: { merchant: true, customer: true }
    });
    if (!order) return res.status(404).send('Order not found.');

    const amount = `${order.currency} ${order.amount.toFixed(2)}`;
    const origin = `${req.protocol}://${req.get('host')}`;
    const returnUrl = `${origin}/?payment=return&order_id=${encodeURIComponent(orderId)}`;
    const defaultCardholderName = order.customer?.name || order.expectedCardholder || '';

    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MOTO Card Entry - ${escapeHtml(orderId)}</title>
  <script src="https://js.stripe.com/v3/"></script>
  <style>
    *{box-sizing:border-box} body{margin:0;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;background:#0f0608;color:#f6efe1;display:flex;align-items:center;justify-content:center;padding:24px}
    .wrap{width:100%;max-width:460px;background:#111318;border:1px solid rgba(232,224,208,.12);border-radius:18px;padding:24px;box-shadow:0 24px 70px rgba(0,0,0,.42)}
    h1{font-size:22px;margin:0 0 6px}.muted{color:rgba(232,224,208,.66);font-size:14px;margin:0 0 18px;line-height:1.5}.box{background:rgba(255,255,255,.04);border:1px solid rgba(232,224,208,.10);border-radius:12px;padding:14px;margin-bottom:18px}
    .row{display:flex;justify-content:space-between;gap:14px;font-size:14px;margin:5px 0}.label{color:rgba(232,224,208,.62)}label{display:block;margin:0 0 10px;color:rgba(232,224,208,.72);font-size:13px;font-weight:700}input{width:100%;padding:12px 14px;border:1px solid rgba(232,224,208,.12);border-radius:12px;background:#1a1d24;color:#f6efe1;font-size:15px;margin-bottom:14px}#payment-element{padding:14px;background:#fff;border-radius:12px;margin-bottom:16px}
    button{width:100%;min-height:48px;border:0;border-radius:12px;background:linear-gradient(135deg,#c8a870,#9f7c42);color:#111318;font-weight:800;font-size:16px;cursor:pointer}
    button:disabled{opacity:.55;cursor:not-allowed}.msg{font-size:14px;margin-top:14px;color:#fca5a5;min-height:20px}.safe{font-size:12px;color:rgba(232,224,208,.55);text-align:center;margin-top:16px}
  </style>
</head>
<body>
  <main class="wrap">
    <h1>MOTO Card Entry</h1>
    <p class="muted">Enter card details securely. This payment is created as a Mail Order / Telephone Order transaction.</p>
    <div class="box">
      <div class="row"><span class="label">Merchant</span><strong>${escapeHtml(order.merchant?.businessName || order.merchant?.name || 'Merchant')}</strong></div>
      <div class="row"><span class="label">Order</span><strong>${escapeHtml(orderId)}</strong></div>
      <div class="row"><span class="label">Amount</span><strong>${escapeHtml(amount)}</strong></div>
      <div class="row"><span class="label">Customer</span><strong>${escapeHtml(order.customer?.name || order.expectedCardholder || 'Walk-in')}</strong></div>
    </div>
    <form id="payment-form">
      <label for="cardholder-name">Cardholder Name</label>
      <input id="cardholder-name" type="text" autocomplete="cc-name" value="${escapeHtml(defaultCardholderName)}" placeholder="Cardholder name" />
      <div id="payment-element"></div>
      <button id="submit">Pay ${escapeHtml(amount)}</button>
      <div id="message" class="msg"></div>
    </form>
    <p class="safe">Card details are handled by Stripe and are not stored on this POS system.</p>
  </main>
  <script>
    const stripe = Stripe(${JSON.stringify(publishableKey)});
    const elements = stripe.elements({ clientSecret: ${JSON.stringify(clientSecret)} });
    elements.create('payment').mount('#payment-element');
    const form = document.getElementById('payment-form');
    const submit = document.getElementById('submit');
    const message = document.getElementById('message');
    const cardholderName = document.getElementById('cardholder-name');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      message.textContent = '';

      const { error: submitError } = await elements.submit();
      if (submitError) {
        message.textContent = submitError.message || 'Please check the card details and try again.';
        submit.disabled = false;
        return;
      }

      const { error: paymentMethodError, paymentMethod } = await stripe.createPaymentMethod({
        elements,
        params: {
          billing_details: {
            name: (cardholderName.value || '').trim() || ${JSON.stringify(defaultCardholderName)}
          }
        }
      });

      if (paymentMethodError || !paymentMethod) {
        message.textContent = paymentMethodError?.message || 'Unable to securely collect card details.';
        submit.disabled = false;
        return;
      }

      const response = await fetch('/moto-card-entry/${encodeURIComponent(orderId)}/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_secret: ${JSON.stringify(clientSecret)},
          payment_method_id: paymentMethod.id,
          cardholder_name: (cardholderName.value || '').trim() || ${JSON.stringify(defaultCardholderName)}
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        message.textContent = result.error || 'Payment failed. Please try another card.';
        submit.disabled = false;
        return;
      }

      window.location.href = result.return_url || ${JSON.stringify(returnUrl)};
    });
  </script>
</body>
</html>`);
  } catch (error) {
    console.error('MOTO card entry page error:', error);
    res.status(500).send('Unable to open payment page.');
  }
});

router.post('/moto-card-entry/:orderId/confirm', express.json(), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { client_secret: clientSecret, payment_method_id: paymentMethodId, cardholder_name: cardholderName } = req.body || {};

    if (!clientSecret || !paymentMethodId) {
      return res.status(400).json({ error: 'Missing payment session details.' });
    }

    const order = await prisma.order.findUnique({
      where: { orderId }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const paymentIntentId = String(clientSecret).split('_secret_')[0];
    if (!paymentIntentId || paymentIntentId !== order.paymentIntentId) {
      return res.status(400).json({ error: 'Payment session mismatch.' });
    }

    const confirmedIntent = await getStripe().paymentIntents.confirm(order.paymentIntentId, {
      payment_method: paymentMethodId,
      payment_method_options: {
        card: {
          moto: true
        }
      },
      metadata: {
        order_id: order.orderId,
        cardholderName: String(cardholderName || '').trim(),
        expected_cardholder: order.expectedCardholder || ''
      }
    });

    if (['succeeded', 'processing', 'requires_payment_method', 'canceled'].includes(confirmedIntent.status)) {
      await PaymentService.handlePaymentIntent(confirmedIntent);
    }

    const origin = `${req.protocol}://${req.get('host')}`;
    const returnUrl = `${origin}/?payment=return&order_id=${encodeURIComponent(orderId)}`;

    if (confirmedIntent.status === 'succeeded' || confirmedIntent.status === 'processing') {
      return res.json({ return_url: returnUrl, status: confirmedIntent.status });
    }

    if (confirmedIntent.status === 'requires_action') {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'failed' }
      });
      return res.status(402).json({
        error: 'This card requires customer authentication and cannot be used for MOTO payments.'
      });
    }

    return res.status(402).json({
      error: confirmedIntent.last_payment_error?.message || 'Card was declined. Please verify the details or try another card.',
      status: confirmedIntent.status
    });
  } catch (error) {
    console.error('MOTO confirm error:', error);
    return res.status(500).json({ error: error.message || 'Unable to process payment.' });
  }
});

router.post('/pos/moto/orders', authenticatePOS, validate(schemas.createMotoOrder), async (req, res) => {
  try {
    const { amount, currency, description, customer_id, customer_name } = req.body;
    const normalizedCurrency = (currency || 'usd').toLowerCase();

    // Resolve customer name for cardholder matching AND check verification status
    let expectedName = customer_name || null;
    if (customer_id) {
      const customer = await prisma.customer.findUnique({ 
        where: { id: customer_id },
        include: { verification: true }
      });

      if (!customer || customer.merchantId !== req.pos.merchantId) {
        return res.status(404).json({
          error: 'Customer not found',
          message: 'The selected customer does not belong to this merchant.'
        });
      }

      expectedName = customer.name;

      // Check if customer is verified
      if (customer.verification?.status !== 'approved') {
        return res.status(400).json({ 
          error: 'Customer not verified',
          message: 'This customer must be verified by admin before processing payments.' 
        });
      }
    }

    const order = await createOrderWithUniqueId({
      merchantId: req.pos.merchantId,
      posId: req.pos.id,
      customerId: customer_id || null,
      amount: amount / 100,
      currency: normalizedCurrency.toUpperCase(),
      description,
      paymentIntentId: null,
      expectedCardholder: expectedName || null
    });
    const orderId = order.orderId;

    const metadata = {
      moto: 'true',
      merchant_id: req.pos.merchantId,
      pos_id: req.pos.posId,
      order_id: orderId,
      expected_cardholder: expectedName || ''
    };

    const paymentIntent = await getStripe().paymentIntents.create({
      amount,
      currency: normalizedCurrency,
      payment_method_types: ['card'],
      description: description || 'MOTO Payment',
      metadata: {
        ...metadata,
        customer_id: customer_id || ''
      }
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentIntentId: paymentIntent.id }
    });

    await prisma.deviceLog.create({
      data: { posId: req.pos.id, merchantId: req.pos.merchantId, action: 'order_created', details: JSON.stringify({ orderId, amount }) }
    });

    const origin = `${req.protocol}://${req.get('host')}`;
    const cardEntryUrl = `${origin}/moto-card-entry/${encodeURIComponent(orderId)}?client_secret=${encodeURIComponent(paymentIntent.client_secret)}`;

    res.json({ order_id: orderId, payment_intent_id: paymentIntent.id, card_entry_url: cardEntryUrl });
  } catch (error) {
    console.error('MOTO order error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/pos/moto-payment', authenticatePOS, validate(schemas.processMotoPayment), async (req, res) => {
  try {
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

    if (customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: { verification: true }
      });

      if (!customer || customer.merchantId !== req.pos.merchantId) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      if (customer.verification?.status !== 'approved') {
        return res.status(400).json({
          error: 'Customer not verified',
          message: 'This customer must be verified by admin before processing payments.'
        });
      }
    }

    const result = await PaymentService.processMotoPayment(
      req.pos.merchantId,
      req.pos.id,
      cardNumber,
      cardExpiry,
      cardCvc,
      cardholderName,
      amount,
      currency,
      customerId || null,
      description || 'MOTO Payment'
    );

    res.json({
      success: result.status === 'succeeded' || result.status === 'processing',
      ...result
    });
  } catch (error) {
    console.error('Direct MOTO payment error:', error);
    const isCardError = typeof error?.type === 'string' && error.type.toLowerCase().includes('card');
    res.status(isCardError ? 402 : 500).json({ error: error.message || 'Failed to process MOTO payment' });
  }
});

router.get('/pos/moto/orders/:orderId', authenticatePOS, async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await prisma.order.findUnique({
      where: { orderId },
      include: { payment: true }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.posId !== req.pos.id || order.merchantId !== req.pos.merchantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      order_id: order.orderId,
      status: order.status,
      card_brand: order.payment?.cardBrand || null,
      last4: order.payment?.cardLast4 || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/pos/transactions', authenticatePOS, validate(schemas.createTransaction), async (req, res) => {
  try {
    const { amount, currency, customer_email } = req.body;
    const transaction = await prisma.transaction.create({
      data: { merchantId: req.pos.merchantId, posId: req.pos.id, amount, currency: currency || 'USD', customerEmail: customer_email, status: 'COMPLETED' }
    });
    res.json({ message: 'Transaction created', transaction });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Live Transactions & Manual Actions ───────────────────────────────────────

// Live transactions (recent 100 orders with full details)
router.get('/admin/live-transactions', authenticateAdmin, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        merchant: true,
        posDevice: true,
        customer: { include: { verification: true } },
        payment: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json({ orders });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Manual refund from admin dashboard
router.post('/admin/orders/:orderId/refund', authenticateAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const order = await prisma.order.findUnique({
      where: { orderId },
      include: { payment: true }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'refunded') return res.status(400).json({ error: 'Already refunded' });
    if (!order.payment?.stripeChargeId) return res.status(400).json({ error: 'No charge ID — cannot refund' });

    // Issue refund via Stripe
    await getStripe().refunds.create({
      charge: order.payment.stripeChargeId,
      reason: 'fraudulent',
      metadata: { admin_reason: reason || 'Admin manual refund', order_id: orderId }
    });

    // Update order
    await prisma.order.update({ where: { orderId }, data: { status: 'refunded' } });

    // Notify merchant
    await prisma.merchantNotification.create({
      data: {
        merchantId: order.merchantId,
        type: 'refund_processed',
        title: '💸 Payment Refunded by Admin',
        message: `Order ${orderId} ($${order.amount.toFixed(2)}) has been refunded by admin. Reason: ${reason || 'Fraud prevention'}. Contact admin for details.`
      }
    });

    res.json({ message: 'Refund issued successfully', orderId });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Block merchant from admin dashboard
router.post('/admin/orders/:orderId/block-merchant', authenticateAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const order = await prisma.order.findUnique({ where: { orderId } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Suspend merchant
    await prisma.merchant.update({
      where: { id: order.merchantId },
      data: { status: 'suspended' }
    });

    // Disable all POS devices
    await prisma.pOSDevice.updateMany({
      where: { merchantId: order.merchantId },
      data: { status: 'disabled' }
    });

    // Notify merchant
    await prisma.merchantNotification.create({
      data: {
        merchantId: order.merchantId,
        type: 'account_suspended',
        title: '🔴 Account Suspended',
        message: `Your account has been suspended by admin. Reason: ${reason || 'Suspicious activity detected'}. All POS devices have been disabled. Contact admin immediately.`
      }
    });

    res.json({ message: 'Merchant blocked and POS disabled' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─── Disputes & Fraud Routes ──────────────────────────────────────────────────

router.get('/admin/disputes', authenticateAdmin, async (req, res) => {
  try {
    const disputes = await prisma.dispute.findMany({
      include: { merchant: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ disputes });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/admin/fraud-flags', authenticateAdmin, async (req, res) => {
  try {
    const flags = await prisma.fraudFlag.findMany({
      include: { merchant: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ flags });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/admin/disputes/:id/evidence', authenticateAdmin, async (req, res) => {
  try {
    const { notes } = req.body;
    const dispute = await prisma.dispute.findUnique({ where: { id: req.params.id } });
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
    await prisma.dispute.update({
      where: { id: req.params.id },
      data: { evidenceSubmitted: true, notes: notes || dispute.notes }
    });
    res.json({ message: 'Evidence marked as submitted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/admin/fraud-flags/:id/resolve', authenticateAdmin, async (req, res) => {
  try {
    await prisma.fraudFlag.update({ where: { id: req.params.id }, data: { resolved: true } });
    res.json({ message: 'Flag resolved' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─── System Status Routes ─────────────────────────────────────────────────────

// Public — anyone can check system status (used by merchant/POS on load)
router.get('/system/status', async (req, res) => {
  try {
    let status = await prisma.systemStatus.findFirst()
    if (!status) {
      status = await prisma.systemStatus.create({
        data: { online: true, message: 'System is operational' }
      })
    }
    res.json({ online: status.online, message: status.message, updatedAt: status.updatedAt })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Admin — toggle system online/offline
router.post('/admin/system/toggle', authenticateAdmin, async (req, res) => {
  try {
    const { online, message } = req.body
    let status = await prisma.systemStatus.findFirst()
    if (!status) {
      status = await prisma.systemStatus.create({ data: { online, message: message || (online ? 'System is operational' : 'System is currently offline for maintenance') } })
    } else {
      status = await prisma.systemStatus.update({
        where: { id: status.id },
        data: { online, message: message || (online ? 'System is operational' : 'System is currently offline for maintenance'), updatedBy: req.admin.email }
      })
    }

    // Notify all merchants
    const merchants = await prisma.merchant.findMany({ where: { status: 'active' } })
    for (const m of merchants) {
      await prisma.merchantNotification.create({
        data: {
          merchantId: m.id,
          type: online ? 'system_online' : 'system_offline',
          title: online ? '✅ System Online' : '🔴 System Offline',
          message: online
            ? 'The system is back online. You can now process payments.'
            : `System has been taken offline by admin. ${message || 'Please try again later.'}`
        }
      })
    }

    res.json({ online: status.online, message: status.message })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ─── Chat Routes ─────────────────────────────────────────────────────────────

// Admin: get all conversations (one per merchant, show latest message)
router.get('/admin/chats', authenticateAdmin, async (req, res) => {
  try {
    const merchants = await prisma.merchant.findMany({
      include: {
        chatMessages: { orderBy: { createdAt: 'desc' }, take: 1 }
      },
      orderBy: { updatedAt: 'desc' }
    });
    const conversations = merchants.map(m => ({
      merchantId: m.id,
      merchantDbId: m.id,
      merchantCode: m.merchantId,
      name: m.businessName || m.name,
      email: m.email,
      lastMessage: m.chatMessages[0] || null,
      unreadCount: 0
    }));
    // Get unread counts
    const unreadCounts = await prisma.chatMessage.groupBy({
      by: ['merchantId'],
      where: { sender: 'merchant', read: false },
      _count: { id: true }
    });
    unreadCounts.forEach(u => {
      const conv = conversations.find(c => c.merchantId === u.merchantId);
      if (conv) conv.unreadCount = u._count.id;
    });
    res.json({ conversations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: get messages with a specific merchant
router.get('/admin/chats/:merchantId', authenticateAdmin, async (req, res) => {
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { merchantId: req.params.merchantId },
      orderBy: { createdAt: 'asc' }
    });
    // Mark merchant messages as read
    await prisma.chatMessage.updateMany({
      where: { merchantId: req.params.merchantId, sender: 'merchant', read: false },
      data: { read: true }
    });
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: send message to merchant
router.post('/admin/chats/:merchantId', authenticateAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });
    const msg = await prisma.chatMessage.create({
      data: { merchantId: req.params.merchantId, sender: 'admin', message: message.trim() }
    });
    // Notify merchant
    await prisma.merchantNotification.create({
      data: {
        merchantId: req.params.merchantId,
        type: 'new_message',
        title: 'New Message from Admin',
        message: message.trim().length > 60 ? message.trim().substring(0, 60) + '...' : message.trim()
      }
    });
    res.json({ message: msg });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Merchant: get messages (chat with admin)
router.get('/merchant/chat', authenticateMerchant, async (req, res) => {
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { merchantId: req.merchant.id },
      orderBy: { createdAt: 'asc' }
    });
    // Mark admin messages as read
    await prisma.chatMessage.updateMany({
      where: { merchantId: req.merchant.id, sender: 'admin', read: false },
      data: { read: true }
    });
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Merchant: send message to admin
router.post('/merchant/chat', authenticateMerchant, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });
    const msg = await prisma.chatMessage.create({
      data: { merchantId: req.merchant.id, sender: 'merchant', message: message.trim() }
    });
    // Notify admin
    const merchant = await prisma.merchant.findUnique({ where: { id: req.merchant.id } });
    await prisma.adminNotification.create({
      data: {
        type: 'new_message',
        title: `Message from ${merchant?.businessName || merchant?.name || 'Merchant'}`,
        message: message.trim().length > 80 ? message.trim().substring(0, 80) + '...' : message.trim(),
        data: JSON.stringify({ merchantId: req.merchant.id })
      }
    });
    res.json({ message: msg });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Merchant: unread message count from admin
router.get('/merchant/chat/unread', authenticateMerchant, async (req, res) => {
  try {
    const count = await prisma.chatMessage.count({
      where: { merchantId: req.merchant.id, sender: 'admin', read: false }
    });
    res.json({ unread: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Merchant submits customer for verification with documents
router.post('/merchant/customers/:customerId/verify', authenticateMerchant, validate(schemas.submitVerification), async (req, res) => {
  try {
    const { customerId } = req.params;
    const { documents, notes } = req.body; // documents = array of { name, base64, type }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, merchantId: req.merchant.id }
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Create or update verification request
    const verification = await prisma.customerVerification.upsert({
      where: { customerId },
      update: {
        status: 'pending',
        documentUrls: JSON.stringify(documents || []),
        notes: notes || null,
        reviewedBy: null,
        reviewedAt: null
      },
      create: {
        customerId,
        merchantId: req.merchant.id,
        status: 'pending',
        documentUrls: JSON.stringify(documents || []),
        notes: notes || null
      }
    });

    // Disable ALL POS devices for this merchant
    await prisma.pOSDevice.updateMany({
      where: { merchantId: req.merchant.id, status: 'active' },
      data: { status: 'disabled' }
    });

    // Log the action for each device
    const devices = await prisma.pOSDevice.findMany({ where: { merchantId: req.merchant.id } });
    for (const p of devices) {
      await prisma.deviceLog.create({
        data: { posId: p.id, merchantId: req.merchant.id, action: 'pos_disabled_for_verification', details: JSON.stringify({ verificationId: verification.id }) }
      });
    }

    // Create notification for merchant
    await prisma.merchantNotification.create({
      data: {
        merchantId: req.merchant.id,
        type: 'verification_submitted',
        title: 'Verification Under Review',
        message: `Customer verification for ${customer.name} has been submitted. Your POS devices have been paused pending admin review.`
      }
    });

    // Notify admin about new verification request
    await prisma.adminNotification.create({
      data: {
        type: 'verification_submitted',
        title: 'New Verification Request',
        message: `${req.merchant.merchantId} submitted customer verification for "${customer.name}". Documents ready for review.`,
        data: JSON.stringify({ verificationId: verification.id, merchantId: req.merchant.id, customerName: customer.name })
      }
    });

    res.json({ message: 'Verification submitted', verificationId: verification.id, posDisabled: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get merchant notifications
router.get('/merchant/notifications', authenticateMerchant, async (req, res) => {
  try {
    const notifications = await prisma.merchantNotification.findMany({
      where: { merchantId: req.merchant.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
router.post('/merchant/notifications/:id/read', authenticateMerchant, async (req, res) => {
  try {
    await prisma.merchantNotification.update({
      where: { id: req.params.id },
      data: { read: true }
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: get all pending verifications
router.get('/admin/verifications', authenticateAdmin, async (req, res) => {
  try {
    const summaryOnly = req.query.summary === 'true';
    const verifications = summaryOnly
      ? await prisma.customerVerification.findMany({
          select: {
            id: true,
            customerId: true,
            merchantId: true,
            status: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
            reviewedBy: true,
            reviewedAt: true,
            customer: { select: { id: true, name: true, email: true, phone: true } },
            merchant: { select: { id: true, merchantId: true, name: true, businessName: true } }
          },
          orderBy: { createdAt: 'desc' }
        })
      : await prisma.customerVerification.findMany({
          include: { customer: true, merchant: true },
          orderBy: { createdAt: 'desc' }
        });
    res.json({ verifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/verifications/:id', authenticateAdmin, async (req, res) => {
  try {
    const verification = await prisma.customerVerification.findUnique({
      where: { id: req.params.id },
      include: { customer: true, merchant: true }
    });
    if (!verification) return res.status(404).json({ error: 'Verification not found' });
    res.json({ verification });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: approve or reject verification
router.post('/admin/verifications/:id/review', authenticateAdmin, validate(schemas.reviewVerification), async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body; // action: 'approved' | 'rejected'

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Action must be approved or rejected' });
    }

    const verification = await prisma.customerVerification.findUnique({
      where: { id },
      include: { merchant: true, customer: true }
    });
    if (!verification) return res.status(404).json({ error: 'Verification not found' });

    // Update verification status
    await prisma.customerVerification.update({
      where: { id },
      data: { status: action, notes: notes || null, reviewedBy: req.admin.email, reviewedAt: new Date() }
    });

    if (action === 'approved') {
      // Re-enable all POS devices for the merchant
      await prisma.pOSDevice.updateMany({
        where: { merchantId: verification.merchantId, status: 'disabled' },
        data: { status: 'active' }
      });

      // Notify merchant
      await prisma.merchantNotification.create({
        data: {
          merchantId: verification.merchantId,
          type: 'verification_approved',
          title: 'Verification Approved',
          message: `Customer verification for ${verification.customer.name} has been approved. Your POS devices have been re-enabled.`
        }
      });
    } else {
      // Notify merchant of rejection
      await prisma.merchantNotification.create({
        data: {
          merchantId: verification.merchantId,
          type: 'verification_rejected',
          title: 'Verification Rejected',
          message: `Customer verification for ${verification.customer.name} was rejected. ${notes ? 'Reason: ' + notes : 'Please re-submit with correct documents.'} Your POS devices remain paused.`
        }
      });
    }

    res.json({ message: `Verification ${action}`, posEnabled: action === 'approved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/webhooks/stripe', handleStripeWebhook);
router.post('/stripe/webhook', handleStripeWebhook);

// ─── Global Error Handler ─────────────────────────────────────────────────────
router.use((err, req, res, next) => {
  console.error('[ERROR]', err.message)
  if (err.message && err.message.startsWith('CORS')) {
    return res.status(403).json({ error: 'Not allowed by CORS policy' })
  }
  res.status(500).json({ error: 'Internal server error' })
})

// ─── Mount router on app ──────────────────────────────────────────────────────
app.use(cors());
app.use(router);

// ─── Export / Start ───────────────────────────────────────────────────────────
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`PrimeStack MOTO POS server running on port ${PORT}`);
  });
}
