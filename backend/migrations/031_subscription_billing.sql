-- Subscription + Billing (Razorpay orders) schema

CREATE TABLE IF NOT EXISTS billing_plans (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  monthly_price_per_user_paise INT NOT NULL,
  workspace_limit INT NOT NULL,
  user_limit INT NOT NULL,
  features JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_user_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id BIGINT NOT NULL REFERENCES billing_plans(id),
  seats INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMP NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_payment_orders (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id BIGINT NOT NULL REFERENCES billing_plans(id),
  seats INT NOT NULL,
  amount_paise INT NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  razorpay_order_id VARCHAR(100) UNIQUE NOT NULL,
  razorpay_payment_id VARCHAR(100),
  razorpay_signature VARCHAR(256),
  status VARCHAR(20) NOT NULL DEFAULT 'created',
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billing_licenses (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id BIGINT NOT NULL REFERENCES billing_user_subscriptions(id) ON DELETE CASCADE,
  license_key VARCHAR(64) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_plans_slug ON billing_plans(slug);
CREATE INDEX IF NOT EXISTS idx_billing_user_subscriptions_user_id ON billing_user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_payment_orders_user_id ON billing_payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_payment_orders_razorpay_order_id ON billing_payment_orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_billing_licenses_user_id ON billing_licenses(user_id);

INSERT INTO billing_plans (name, slug, monthly_price_per_user_paise, workspace_limit, user_limit, features, is_active)
VALUES
(
  'Pro',
  'pro',
  25000,
  1,
  50,
  '{"all_features": true}',
  true
),
(
  'Business',
  'business',
  30000,
  3,
  100,
  '{"all_features": true}',
  true
)
ON CONFLICT (slug) DO NOTHING;
