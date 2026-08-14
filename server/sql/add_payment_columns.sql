-- ================== Payment Gateway migration ==================
-- Run this once against your existing SwasthAashra database:
--   mysql -u root -p swasthashra < server/sql/add_payment_columns.sql
--
-- Note: the original `billing.js` route queried a table called `bills`,
-- but init_all.sql actually creates it as `billing`. This migration adds
-- the new payment-tracking columns to the real `billing` table - no
-- separate `bills` table is needed.

ALTER TABLE billing
  ADD COLUMN IF NOT EXISTS razorpay_order_id   VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS paid_at             TIMESTAMP NULL;
