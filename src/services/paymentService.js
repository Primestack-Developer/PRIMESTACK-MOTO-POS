const stripe = require('../config/stripe');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const { generateOrderId, generateTransactionId } = require('../utils/helpers');

class PaymentService {
  static async createPaymentIntent(merchantId, posId, amount, currency, customerId) {
    try {
      const customer = customerId ? await prisma.customer.findUnique({
        where: { id: customerId, merchantId }
      }) : null;

      let stripeCustomerId = null;
      if (customer?.stripeCustomerId) {
        stripeCustomerId = customer.stripeCustomerId;
      } else if (customer) {
        const stripeCustomer = await stripe.customers.create({
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          metadata: { merchantId, customerId: customer.id }
        });
        await prisma.customer.update({
          where: { id: customer.id },
          data: { stripeCustomerId: stripeCustomer.id }
        });
        stripeCustomerId = stripeCustomer.id;
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        customer: stripeCustomerId,
        capture_method: 'manual',
        metadata: { merchantId, posId, customerId: customerId || '' }
      });

      const order = await prisma.order.create({
        data: {
          orderId: generateOrderId(),
          merchantId,
          posId,
          customerId,
          amount,
          currency,
          paymentIntentId: paymentIntent.id,
          status: 'pending'
        }
      });

      return {
        success: true,
        clientSecret: paymentIntent.client_secret,
        orderId: order.orderId,
        paymentIntentId: paymentIntent.id
      };
    } catch (error) {
      logger.error('Failed to create payment intent', { error: error.message });
      throw error;
    }
  }

  static async processMotoPayment(merchantId, posId, cardNumber, cardExpiry, cardCvc, cardholderName, amount, currency, customerId, description) {
    try {
      const [expMonth, expYear] = cardExpiry.split('/');

      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: cardNumber,
          exp_month: parseInt(expMonth),
          exp_year: parseInt(expYear),
          cvc: cardCvc
        },
        billing_details: {
          name: cardholderName
        }
      });

      const customer = customerId ? await prisma.customer.findUnique({
        where: { id: customerId, merchantId }
      }) : null;

      let stripeCustomerId = null;
      if (customer?.stripeCustomerId) {
        stripeCustomerId = customer.stripeCustomerId;
      } else if (customer) {
        const stripeCustomer = await stripe.customers.create({
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          metadata: { merchantId, customerId: customer.id }
        });
        await prisma.customer.update({
          where: { id: customer.id },
          data: { stripeCustomerId: stripeCustomer.id }
        });
        stripeCustomerId = stripeCustomer.id;
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        payment_method: paymentMethod.id,
        customer: stripeCustomerId,
        description,
        confirm: true,
        capture_method: 'manual',
        payment_method_types: ['card'],
        payment_method_options: {
          card: {
            moto: 'yes'
          }
        },
        metadata: {
          merchantId,
          posId,
          cardholderName,
          customerId: customerId || ''
        }
      });

      const order = await prisma.order.create({
        data: {
          orderId: generateOrderId(),
          merchantId,
          posId,
          customerId,
          amount,
          currency,
          description,
          paymentIntentId: paymentIntent.id,
          expectedCardholder: cardholderName,
          status: paymentIntent.status === 'succeeded' ? 'processing' : 'pending'
        }
      });

      const charge = paymentIntent.charges?.data[0];
      const actualCardholderName = charge?.payment_method_details?.card?.checks?.cardholder_check === 'pass' ? cardholderName : charge?.billing_details?.name;

      await prisma.transaction.create({
        data: {
          merchantId,
          posId,
          amount,
          currency,
          status: paymentIntent.status === 'succeeded' ? 'SUCCESS' : 'PENDING',
          stripePaymentIntentId: paymentIntent.id,
          stripeChargeId: charge?.id,
          customerEmail: customer?.email,
          customerName: customer?.name,
          cardholderName: actualCardholderName,
          cardLast4: charge?.payment_method_details?.card?.last4,
          cardBrand: charge?.payment_method_details?.card?.brand,
          riskLevel: charge?.outcome?.risk_level,
          orderId: order.orderId
        }
      });

      await prisma.deviceLog.create({
        data: {
          posId,
          merchantId,
          action: 'payment_initiated',
          details: JSON.stringify({ orderId: order.orderId, amount, currency })
        }
      });

      let finalIntent = paymentIntent;

      if (paymentIntent.status === 'requires_confirmation') {
        const confirmedIntent = await stripe.paymentIntents.confirm(paymentIntent.id);
        finalIntent = confirmedIntent;
      }

      if (finalIntent.status === 'requires_capture') {
        finalIntent = await stripe.paymentIntents.capture(finalIntent.id);
      }

      if (finalIntent.status === 'succeeded' || finalIntent.status === 'processing' || finalIntent.status === 'requires_payment_method' || finalIntent.status === 'canceled') {
        await this.handlePaymentIntent(finalIntent);
      }

      const finalCharge = finalIntent.charges?.data[0];

      return {
        success: true,
        status: finalIntent.status,
        orderId: order.orderId,
        paymentIntentId: finalIntent.id,
        cardBrand: finalCharge?.payment_method_details?.card?.brand || charge?.payment_method_details?.card?.brand || null,
        cardLast4: finalCharge?.payment_method_details?.card?.last4 || charge?.payment_method_details?.card?.last4 || null,
        cardholderName: finalCharge?.billing_details?.name || cardholderName
      };
    } catch (error) {
      logger.error('Failed to process MOTO payment', { error: error.message });
      throw error;
    }
  }

  static async capturePayment(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
      await this.handlePaymentIntent(paymentIntent);
      return paymentIntent;
    } catch (error) {
      logger.error('Failed to capture payment', { error: error.message });
      throw error;
    }
  }

  static async checkCardholderMismatch(order, charge) {
    if (!order.expectedCardholder) {
      return false;
    }
    const expected = order.expectedCardholder.toLowerCase().trim();
    const actual = (charge?.billing_details?.name || '').toLowerCase().trim();
    if (!actual) {
      return false;
    }
    return expected !== actual;
  }

  static async handlePaymentIntent(paymentIntent) {
    try {
      const order = await prisma.order.findUnique({
        where: { paymentIntentId: paymentIntent.id }
      });

      if (!order) {
        logger.warn('Order not found for payment intent', { paymentIntentId: paymentIntent.id });
        return;
      }

      let orderStatus = 'pending';
      let paymentStatus = 'pending';

      switch (paymentIntent.status) {
        case 'succeeded':
          orderStatus = 'processing';
          paymentStatus = 'succeeded';
          break;
        case 'processing':
          orderStatus = 'processing';
          paymentStatus = 'pending';
          break;
        case 'requires_payment_method':
          orderStatus = 'failed';
          paymentStatus = 'failed';
          break;
        case 'canceled':
          orderStatus = 'canceled';
          paymentStatus = 'failed';
          break;
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { status: orderStatus }
      });

      const existingPayment = await prisma.payment.findUnique({
        where: { orderId: order.id }
      });

      const charge = paymentIntent.charges?.data[0];
      const actualCardholderName = charge?.billing_details?.name || paymentIntent.metadata?.cardholderName;

      if (existingPayment) {
        await prisma.payment.update({
          where: { id: existingPayment.id },
          data: {
            stripeChargeId: charge?.id,
            cardBrand: charge?.payment_method_details?.card?.brand,
            cardLast4: charge?.payment_method_details?.card?.last4,
            cardholderName: actualCardholderName,
            riskLevel: charge?.outcome?.risk_level,
            receiptUrl: charge?.receipt_url,
            status: paymentStatus
          }
        });
      } else {
        await prisma.payment.create({
          data: {
            orderId: order.id,
            merchantId: order.merchantId,
            posId: order.posId,
            stripeChargeId: charge?.id,
            cardBrand: charge?.payment_method_details?.card?.brand,
            cardLast4: charge?.payment_method_details?.card?.last4,
            cardholderName: actualCardholderName,
            riskLevel: charge?.outcome?.risk_level,
            receiptUrl: charge?.receipt_url,
            status: paymentStatus
          }
        });
      }

      const transaction = await prisma.transaction.findFirst({
        where: { stripePaymentIntentId: paymentIntent.id }
      });

      if (transaction) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: orderStatus === 'processing' ? 'SUCCESS' : orderStatus === 'failed' || orderStatus === 'canceled' ? 'FAILED' : 'PENDING',
            stripeChargeId: charge?.id,
            cardholderName: actualCardholderName,
            cardLast4: charge?.payment_method_details?.card?.last4,
            cardBrand: charge?.payment_method_details?.card?.brand,
            riskLevel: charge?.outcome?.risk_level
          }
        });
      }

      if (orderStatus === 'processing') {
        await prisma.merchantNotification.create({
          data: {
            merchantId: order.merchantId,
            type: 'payment_success',
            title: 'Payment Successful',
            message: `Payment of ${order.currency} ${order.amount.toFixed(2)} received for order ${order.orderId}`
          }
        });

        await prisma.adminNotification.create({
          data: {
            type: 'payment_succeeded',
            title: 'New Payment Received',
            message: `Payment of ${order.currency} ${order.amount.toFixed(2)} received for order ${order.orderId} from merchant ${order.merchantId}`,
            data: JSON.stringify({ orderId: order.orderId, merchantId: order.merchantId, amount: order.amount, currency: order.currency })
          }
        });

        const isMismatch = await this.checkCardholderMismatch(order, charge);
        if (isMismatch) {
          await prisma.fraudFlag.create({
            data: {
              orderId: order.id,
              merchantId: order.merchantId,
              type: 'cardholder_name_mismatch',
              details: JSON.stringify({
                expected: order.expectedCardholder,
                actual: actualCardholderName,
                orderId: order.orderId,
                chargeId: charge?.id
              }),
              severity: 'high',
              resolved: false
            }
          });

          await prisma.adminNotification.create({
            data: {
              type: 'payment_flagged',
              title: '🚨 Fraud Alert: Cardholder Name Mismatch',
              message: `Order ${order.orderId} has a cardholder name mismatch! Expected: "${order.expectedCardholder}", Actual: "${actualCardholderName}". Merchant: ${order.merchantId}`,
              data: JSON.stringify({ orderId: order.orderId, merchantId: order.merchantId, expected: order.expectedCardholder, actual: actualCardholderName })
            }
          });
        }
      } else if (orderStatus === 'failed') {
        await prisma.merchantNotification.create({
          data: {
            merchantId: order.merchantId,
            type: 'payment_failed',
            title: 'Payment Failed',
            message: `Payment failed for order ${order.orderId}`
          }
        });
      }

      logger.info('Payment intent handled successfully', { paymentIntentId: paymentIntent.id, status: orderStatus });
    } catch (error) {
      logger.error('Failed to handle payment intent', { error: error.message });
      throw error;
    }
  }

  static async handleRefund(refund) {
    try {
      const chargeId = refund.charge;
      let transaction = await prisma.transaction.findFirst({
        where: { stripeChargeId: chargeId }
      });

      if (!transaction) {
        logger.warn('Transaction not found for refund', { stripeRefundId: refund.id, stripeChargeId: chargeId });
        return;
      }

      const existingRefund = await prisma.refund.findUnique({
        where: { stripeRefundId: refund.id }
      });

      if (existingRefund) {
        logger.info('Refund already exists', { stripeRefundId: refund.id });
        return;
      }

      await prisma.refund.create({
        data: {
          merchantId: transaction.merchantId,
          transactionId: transaction.id,
          stripeRefundId: refund.id,
          stripeChargeId: chargeId,
          amount: refund.amount / 100,
          currency: refund.currency.toUpperCase(),
          reason: refund.reason,
          status: refund.status
        }
      });

      await prisma.adminNotification.create({
        data: {
          type: 'refund_processed',
          title: 'Refund Processed',
          message: `A refund of ${refund.currency.toUpperCase()} ${(refund.amount / 100).toFixed(2)} has been processed for transaction ${transaction.id} (reason: ${refund.reason || 'not specified'})`,
          data: JSON.stringify({ refundId: refund.id, transactionId: transaction.id, amount: refund.amount / 100, reason: refund.reason })
        }
      });

      await prisma.merchantNotification.create({
        data: {
          merchantId: transaction.merchantId,
          type: 'refund_received',
          title: 'Refund Issued',
          message: `A refund of ${refund.currency.toUpperCase()} ${(refund.amount / 100).toFixed(2)} has been issued to your customer${refund.reason ? ` (reason: ${refund.reason})` : ''}`
        }
      });

      logger.info('Refund handled successfully', { stripeRefundId: refund.id });
    } catch (error) {
      logger.error('Failed to handle refund', { error: error.message });
      throw error;
    }
  }
}

module.exports = PaymentService;
