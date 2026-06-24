const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const PaymentService = require('../services/paymentService');

router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error('Webhook signature verification failed', { error: err.message });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await prisma.webhookLog.create({
      data: {
        eventType: event.type,
        payload: JSON.stringify(event.data.object)
      }
    });

    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'payment_intent.processing':
      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled':
        await PaymentService.handlePaymentIntent(event.data.object);
        break;
      case 'charge.refunded':
      case 'charge.refund.updated':
        await PaymentService.handleRefund(event.data.object);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Failed to process webhook', { error: error.message, eventType: event.type });
    res.status(500).json({ received: true, error: 'Processing failed' });
  }
});

module.exports = router;
