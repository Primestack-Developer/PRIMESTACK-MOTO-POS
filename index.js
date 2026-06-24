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

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;

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
    billingAddress: z.string().max(200).optional().or(z.literal('')).transform(v => v || null)
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

// ─── Security Middleware ──────────────────────────────────────────────────────

// 1. Helmet — sets secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: false, // disabled so Stripe iframe works
  crossOriginEmbedderPolicy: false
}))

// 2. CORS — only allow known origins
const allowedOrigins = [
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  process.env.ADMIN_URL,
  process.env.MERCHANT_URL,
  process.env.POS_URL,
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Stripe webhooks)
    if (!origin) return cb(null, true)
    if (allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: Origin ${origin} not allowed`))
  },
  credentials: true
}))

// 3. Rate limiters
app.use(apiLimiter)

// 4. Raw body for Stripe webhooks — MUST come before express.json()
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }))
app.use('/stripe/webhook',  express.raw({ type: 'application/json' }))

// 5. Body parser with size limit for document uploads
app.use(express.json({ limit: '20mb' }))

// 6. HPP — prevent HTTP parameter pollution
app.use(hpp())

// 7. Input sanitisation — strip any $ or . keys (NoSQL injection protection)
app.use((req, _res, next) => {
  const clean = (obj) => {
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(k => {
        if (k.startsWith('$') || k.includes('.')) delete obj[k]
        else clean(obj[k])
      })
    }
  }
  clean(req.body)
  clean(req.query)
  clean(req.params)
  next()
})

// 8. Security response headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  next()
})

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
  const count = await prisma.pOSDevice.count();
  return `PS-TM-${String(count + 1).padStart(6, '0')}`;
};

const generateActivationCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg()}-${seg()}`;
};

const generateOrderId = async () => {
  const count = await prisma.order.count();
  return `ORD-${String(count + 1).padStart(6, '0')}`;
};

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
    await prisma.webhookLog.create({
      data: { eventType: event.type, payload: JSON.stringify(event.data.object) }
    });

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const orderId = pi.metadata?.order_id;
      if (!orderId) return res.json({ received: true });

      const order = await prisma.order.findUnique({ where: { orderId } });
      if (!order) return res.json({ received: true });

      const charge = pi.charges?.data?.[0];
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
      await prisma.order.update({ where: { orderId }, data: { status: 'paid' } });

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

app.post('/admin/register', validate(schemas.adminRegister), async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await prisma.admin.create({ data: { email, password: hashedPassword, name } });
    res.json({ message: 'Admin created successfully', admin: { id: admin.id, email: admin.email, name: admin.name } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/login', loginLimiter, checkBruteForce, validate(schemas.adminLogin), async (req, res) => {
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
      const failedLogins = admin.failedLogins + 1
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
app.post('/admin/login/recovery', loginLimiter, async (req, res) => {
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
app.put('/admin/password', authenticateAdmin, async (req, res) => {
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
app.post('/admin/pin/set', authenticateAdmin, async (req, res) => {
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

app.post('/admin/pin/verify', authenticateAdmin, async (req, res) => {
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
app.post('/admin/recovery-key/regenerate', authenticateAdmin, async (req, res) => {
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

app.post('/admin/merchants', authenticateAdmin, validate(schemas.createMerchant), async (req, res) => {
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

app.get('/admin/merchants', authenticateAdmin, async (req, res) => {
  try {
    const merchants = await prisma.merchant.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ merchants });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/merchants/:merchantId/status', authenticateAdmin, validate(schemas.merchantStatus), async (req, res) => {
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

app.post('/admin/merchants/:merchantId/reset-password', authenticateAdmin, async (req, res) => {
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

app.post('/admin/merchants/:merchantId/pos-devices', authenticateAdmin, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const merchant = await prisma.merchant.findUnique({ where: { merchantId } });
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    const posId = await generatePosId();
    const activationCode = generateActivationCode();

    const posDevice = await prisma.pOSDevice.create({
      data: {
        posId,
        merchantId: merchant.id,
        activationCode,
        status: 'pending'
      }
    });

    // Notify merchant
    await prisma.merchantNotification.create({
      data: {
        merchantId: merchant.id,
        type: 'pos_created',
        title: 'New POS Device Added',
        message: `A new POS device has been created! Activation Code: ${activationCode}`
      }
    });

    res.json({
      pos_id: posDevice.posId,
      activation_code: activationCode,
      status: posDevice.status
    });
  } catch (error) {
    console.error('Create POS device error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/merchants/:merchantId', authenticateAdmin, async (req, res) => {
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
    await prisma.chatMessage.deleteMany({ 
      where: { 
        OR: [
          { senderId: merchant.id, senderType: 'merchant' },
          { receiverId: merchant.id, receiverType: 'merchant' }
        ]
      }
    });
    // Finally delete the merchant
    await prisma.merchant.delete({ where: { merchantId } });

    res.json({ message: 'Merchant deleted successfully' });
  } catch (error) {
    console.error('Delete merchant error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/pos-devices', authenticateAdmin, async (req, res) => {
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

app.get('/admin/orders', authenticateAdmin, async (req, res) => {
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

app.get('/admin/transactions', authenticateAdmin, async (req, res) => {
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

app.post('/admin/pos-devices/:posId/status', authenticateAdmin, validate(schemas.posStatus), async (req, res) => {
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

app.get('/admin/notifications', authenticateAdmin, async (req, res) => {
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

app.post('/admin/notifications/:id/read', authenticateAdmin, async (req, res) => {
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

app.post('/admin/notifications/read-all', authenticateAdmin, async (req, res) => {
  try {
    await prisma.adminNotification.updateMany({ data: { read: true } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/webhook-logs', authenticateAdmin, async (req, res) => {
  try {
    const webhookLogs = await prisma.webhookLog.findMany({ orderBy: { receivedAt: 'desc' } });
    res.json({ webhookLogs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Merchant Routes ──────────────────────────────────────────────────────────

app.post('/merchant/login', loginLimiter, checkBruteForce, validate(schemas.merchantLogin), async (req, res) => {
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

app.post('/merchant/pos-devices', authenticateMerchant, async (req, res) => {
  try {
    const posId = await generatePosId();
    const activationCode = generateActivationCode();
    const posDevice = await prisma.pOSDevice.create({
      data: { posId, merchantId: req.merchant.id, activationCode }
    });
    res.json({ pos_id: posDevice.posId, activation_code: posDevice.activationCode, status: posDevice.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/merchant/pos-devices', authenticateMerchant, async (req, res) => {
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

app.get('/merchant/customers', authenticateMerchant, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { merchantId: req.merchant.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ customers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/merchant/customers', authenticateMerchant, validate(schemas.createCustomer), async (req, res) => {
  try {
    const { name, email, phone, billingAddress } = req.body;
    const customer = await prisma.customer.create({
      data: { merchantId: req.merchant.id, name, email: email || null, phone: phone || null, billingAddress: billingAddress || null }
    });
    res.json({ customer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/merchant/orders', authenticateMerchant, async (req, res) => {
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

app.get('/merchant/transactions', authenticateMerchant, async (req, res) => {
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

app.put('/merchant/profile', authenticateMerchant, validate(schemas.updateProfile), async (req, res) => {
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

app.put('/merchant/password', authenticateMerchant, validate(schemas.changePassword), async (req, res) => {
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

app.post('/pos/activate', activationLimiter, validate(schemas.activatePOS), async (req, res) => {
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

app.post('/pos/heartbeat', authenticatePOS, async (req, res) => {
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

app.get('/pos/customers', authenticatePOS, async (req, res) => {
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

app.post('/pos/customers', authenticatePOS, validate(schemas.createCustomer), async (req, res) => {
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

app.get('/pos/orders', authenticatePOS, async (req, res) => {
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

app.post('/pos/moto/orders', authenticatePOS, validate(schemas.createMotoOrder), async (req, res) => {
  try {
    const { amount, currency, description, customer_id, customer_name } = req.body;
    const orderId = await generateOrderId();

    // Resolve customer name for cardholder matching AND check verification status
    let expectedName = customer_name || null;
    if (customer_id && !expectedName) {
      const customer = await prisma.customer.findUnique({ 
        where: { id: customer_id },
        include: { verification: true }
      });
      if (customer) {
        expectedName = customer.name;
        
        // Check if customer is verified
        if (customer.verification?.status !== 'approved') {
          return res.status(400).json({ 
            error: 'Customer not verified',
            message: 'This customer must be verified by admin before processing payments.' 
          });
        }
      }
    }

    const paymentIntent = await getStripe().paymentIntents.create({
      amount,
      currency: currency || 'usd',
      description: description || 'MOTO Payment',
      payment_method_types: ['card'], // accept all card types worldwide
      metadata: {
        moto: 'true',
        merchant_id: req.pos.merchantId,
        pos_id: req.pos.posId,
        order_id: orderId,
        expected_cardholder: expectedName || ''
      }
    });

    const paymentLink = await getStripe().paymentLinks.create({
      line_items: [{
        price_data: {
          currency: currency || 'usd',
          product_data: { name: description || 'MOTO Payment' },
          unit_amount: amount
        },
        quantity: 1
      }],
      billing_address_collection: 'auto', // optional — not forced for international cards
      phone_number_collection: { enabled: false },
      metadata: { moto: 'true', merchant_id: req.pos.merchantId, pos_id: req.pos.posId, order_id: orderId }
    });

    const order = await prisma.order.create({
      data: {
        orderId,
        merchantId: req.pos.merchantId,
        posId: req.pos.id,
        customerId: customer_id || null,
        amount: amount / 100,
        currency: (currency || 'usd').toUpperCase(),
        description,
        paymentIntentId: paymentIntent.id,
        expectedCardholder: expectedName || null
      }
    });

    await prisma.deviceLog.create({
      data: { posId: req.pos.id, merchantId: req.pos.merchantId, action: 'order_created', details: JSON.stringify({ orderId, amount }) }
    });

    res.json({ order_id: orderId, payment_intent_id: paymentIntent.id, card_entry_url: paymentLink.url });
  } catch (error) {
    console.error('MOTO order error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/pos/moto/orders/:orderId', authenticatePOS, async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await prisma.order.findUnique({
      where: { orderId },
      include: { payment: true }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

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

app.post('/pos/transactions', authenticatePOS, validate(schemas.createTransaction), async (req, res) => {
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
app.get('/admin/live-transactions', authenticateAdmin, async (req, res) => {
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
app.post('/admin/orders/:orderId/refund', authenticateAdmin, async (req, res) => {
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
app.post('/admin/orders/:orderId/block-merchant', authenticateAdmin, async (req, res) => {
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

app.get('/admin/disputes', authenticateAdmin, async (req, res) => {
  try {
    const disputes = await prisma.dispute.findMany({
      include: { merchant: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ disputes });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/fraud-flags', authenticateAdmin, async (req, res) => {
  try {
    const flags = await prisma.fraudFlag.findMany({
      include: { merchant: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ flags });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/disputes/:id/evidence', authenticateAdmin, async (req, res) => {
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

app.post('/admin/fraud-flags/:id/resolve', authenticateAdmin, async (req, res) => {
  try {
    await prisma.fraudFlag.update({ where: { id: req.params.id }, data: { resolved: true } });
    res.json({ message: 'Flag resolved' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─── System Status Routes ─────────────────────────────────────────────────────

// Public — anyone can check system status (used by merchant/POS on load)
app.get('/system/status', async (req, res) => {
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
app.post('/admin/system/toggle', authenticateAdmin, async (req, res) => {
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
app.get('/admin/chats', authenticateAdmin, async (req, res) => {
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
app.get('/admin/chats/:merchantId', authenticateAdmin, async (req, res) => {
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
app.post('/admin/chats/:merchantId', authenticateAdmin, async (req, res) => {
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
app.get('/merchant/chat', authenticateMerchant, async (req, res) => {
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
app.post('/merchant/chat', authenticateMerchant, async (req, res) => {
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
app.get('/merchant/chat/unread', authenticateMerchant, async (req, res) => {
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
app.post('/merchant/customers/:customerId/verify', authenticateMerchant, validate(schemas.submitVerification), async (req, res) => {
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
app.get('/merchant/notifications', authenticateMerchant, async (req, res) => {
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
app.post('/merchant/notifications/:id/read', authenticateMerchant, async (req, res) => {
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
app.get('/admin/verifications', authenticateAdmin, async (req, res) => {
  try {
    const verifications = await prisma.customerVerification.findMany({
      include: { customer: true, merchant: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ verifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: approve or reject verification
app.post('/admin/verifications/:id/review', authenticateAdmin, validate(schemas.reviewVerification), async (req, res) => {
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

app.post('/webhooks/stripe', handleStripeWebhook);
app.post('/stripe/webhook', handleStripeWebhook);

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Catches any unhandled errors and returns safe messages (no stack traces)
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message)
  if (err.message && err.message.startsWith('CORS')) {
    return res.status(403).json({ error: 'Not allowed by CORS policy' })
  }
  res.status(500).json({ error: 'Internal server error' })
})

// ─── Start Server / Export ───────────────────────────────────────────────────

// Export app for server.js (production static file serving)
module.exports = app;

// Start directly only when run as main module (local dev: node index.js)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`PrimeStack MOTO POS server running on port ${PORT}`);
  });
}
