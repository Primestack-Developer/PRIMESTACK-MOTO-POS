const ORDER_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELED: 'canceled'
};

const POS_STATUSES = {
  PENDING: 'pending',
  ACTIVE: 'active',
  INACTIVE: 'inactive'
};

const PAYMENT_STATUSES = {
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  REQUIRES_ACTION: 'requires_action'
};

const TRANSACTION_STATUSES = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED'
};

const NOTIFICATION_TYPES = {
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  NEW_ORDER: 'new_order',
  SYSTEM_ALERT: 'system_alert',
  ACCOUNT_UPDATE: 'account_update'
};

module.exports = {
  ORDER_STATUSES,
  POS_STATUSES,
  PAYMENT_STATUSES,
  TRANSACTION_STATUSES,
  NOTIFICATION_TYPES
};
