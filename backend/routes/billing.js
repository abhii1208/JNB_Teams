const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { DateTime } = require('luxon');
const { pool } = require('../db');

const router = express.Router();

const isMockMode = () => String(process.env.RAZORPAY_MOCK || '').toLowerCase() === 'true';

const getMonthlyPriceOverridePaise = () => {
  const raw = String(process.env.BILLING_MONTHLY_PRICE_PER_USER_PAISE_OVERRIDE || '').trim();
  if (!raw) return null;
  const val = Number.parseInt(raw, 10);
  if (!Number.isFinite(val) || val < 0) return null;
  return val;
};

const getRazorpayClient = () => {
  if (isMockMode()) return null;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    const err = new Error('Razorpay is not configured (missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET).');
    err.statusCode = 500;
    throw err;
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

const mapPlanToLicenseType = (planSlug) => {
  if (planSlug === 'business') return 'licensed_admin';
  if (planSlug === 'pro') return 'licensed_user';
  return 'free';
};

router.get('/plans', async (_req, res) => {
  const result = await pool.query(
    `SELECT id, name, slug, monthly_price_per_user_paise, workspace_limit, user_limit, features
     FROM billing_plans
     WHERE is_active = true
     ORDER BY monthly_price_per_user_paise ASC`
  );
  const override = getMonthlyPriceOverridePaise();
  if (override === null) return res.json(result.rows);
  return res.json(
    (result.rows || []).map((row) => ({
      ...row,
      monthly_price_per_user_paise: override,
    }))
  );
});

router.post('/checkout/order', async (req, res) => {
  const planSlug = String(req.body.plan_slug || '').trim().toLowerCase();
  const seats = Number.parseInt(req.body.seats, 10);

  if (!planSlug) return res.status(400).json({ error: 'plan_slug is required' });
  if (!Number.isFinite(seats) || seats <= 0) return res.status(400).json({ error: 'seats must be a positive integer' });

  const planRes = await pool.query(
    `SELECT id, name, slug, monthly_price_per_user_paise, workspace_limit, user_limit
     FROM billing_plans
     WHERE slug = $1 AND is_active = true
     LIMIT 1`,
    [planSlug]
  );
  if (planRes.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });

  const plan = planRes.rows[0];
  if (seats > plan.user_limit) {
    return res.status(400).json({ error: `Seat limit exceeded (max ${plan.user_limit})` });
  }

  const monthlyPricePerUserPaise = getMonthlyPriceOverridePaise() ?? plan.monthly_price_per_user_paise;
  const amount = seats * monthlyPricePerUserPaise;
  const receipt = `sub_${plan.slug}_${req.userId}_${Date.now()}`;

  const razorpay = getRazorpayClient();
  const order = isMockMode()
    ? { id: `order_mock_${crypto.randomBytes(8).toString('hex')}`, amount, currency: 'INR' }
    : await razorpay.orders.create({
        amount,
        currency: 'INR',
        receipt,
        notes: {
          user_id: String(req.userId),
          plan_slug: plan.slug,
          seats: String(seats),
        },
      });

  await pool.query(
    `INSERT INTO billing_payment_orders (user_id, plan_id, seats, amount_paise, currency, razorpay_order_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'created')
     ON CONFLICT (razorpay_order_id) DO NOTHING`,
    [req.userId, plan.id, seats, order.amount, order.currency, order.id]
  );

  res.json({
    keyId: isMockMode() ? 'mock' : process.env.RAZORPAY_KEY_ID,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    mock: isMockMode(),
    plan: {
      slug: plan.slug,
      name: plan.name,
      workspace_limit: plan.workspace_limit,
      user_limit: plan.user_limit,
      monthly_price_per_user_paise: monthlyPricePerUserPaise,
    },
    seats,
  });
});

router.post('/checkout/verify', async (req, res) => {
  const razorpayOrderId = String(req.body.razorpay_order_id || '').trim();
  const razorpayPaymentId = String(req.body.razorpay_payment_id || '').trim();
  const razorpaySignature = String(req.body.razorpay_signature || '').trim();

  if (!razorpayOrderId) {
    return res.status(400).json({ error: 'razorpay_order_id is required' });
  }

  if (!isMockMode() && (!razorpayPaymentId || !razorpaySignature)) {
    return res.status(400).json({ error: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required' });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!isMockMode() && !keySecret) {
    return res.status(500).json({ error: 'Razorpay is not configured (missing RAZORPAY_KEY_SECRET).' });
  }

  if (!isMockMode()) {
    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expected !== razorpaySignature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      `SELECT po.id, po.plan_id, po.seats, po.amount_paise, po.status, sp.slug as plan_slug
       FROM billing_payment_orders po
       JOIN billing_plans sp ON sp.id = po.plan_id
       WHERE po.razorpay_order_id = $1 AND po.user_id = $2
       LIMIT 1`,
      [razorpayOrderId, req.userId]
    );

    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderRow = orderRes.rows[0];
    if (orderRow.status === 'paid') {
      await client.query('COMMIT');
      return res.json({ success: true, message: 'Already processed' });
    }

    const effectivePaymentId = razorpayPaymentId || `pay_mock_${crypto.randomBytes(8).toString('hex')}`;
    const effectiveSignature = razorpaySignature || 'mock';

    await client.query(
      `UPDATE billing_payment_orders
       SET razorpay_payment_id = $1, razorpay_signature = $2, status = 'paid', paid_at = NOW()
       WHERE id = $3`,
      [effectivePaymentId, effectiveSignature, orderRow.id]
    );

    const now = DateTime.utc();
    const periodEnd = now.plus({ months: 1 }).toJSDate();

    const subRes = await client.query(
      `INSERT INTO billing_user_subscriptions (user_id, plan_id, seats, status, current_period_start, current_period_end)
       VALUES ($1, $2, $3, 'active', NOW(), $4)
       RETURNING id`,
      [req.userId, orderRow.plan_id, orderRow.seats, periodEnd]
    );

    const subscriptionId = subRes.rows[0].id;
    const licenseKey = `LIC-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;

    await client.query(
      `INSERT INTO billing_licenses (user_id, subscription_id, license_key)
       VALUES ($1, $2, $3)`,
      [req.userId, subscriptionId, licenseKey]
    );

    const licenseType = mapPlanToLicenseType(orderRow.plan_slug);
    await client.query(
      `UPDATE users
       SET license_type = $1
       WHERE id = $2`,
      [licenseType, req.userId]
    );

    await client.query('COMMIT');
    return res.json({ success: true, subscription_id: subscriptionId, license_key: licenseKey });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Billing verify error:', err);
    return res.status(500).json({ error: 'Failed to verify payment' });
  } finally {
    client.release();
  }
});

module.exports = router;
