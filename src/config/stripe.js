const Stripe = require('stripe');

let stripe = null;

const getStripe = () => {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key.startsWith('sk_test_your')) {
      throw new Error('STRIPE_SECRET_KEY is not configured.');
    }
    stripe = new Stripe(key);
  }
  return stripe;
};

// Export as a proxy that lazily initializes
module.exports = new Proxy({}, {
  get(_, prop) {
    return getStripe()[prop];
  }
});
