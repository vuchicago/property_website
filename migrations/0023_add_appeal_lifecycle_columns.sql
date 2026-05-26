CREATE TABLE IF NOT EXISTS appeals_rebuilt_0023 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  property_address TEXT,
  property_key TEXT,
  property_pin TEXT,
  payment_intent_id TEXT,
  payment_amount INTEGER,
  payment_status TEXT,
  payment_date DATETIME,
  appeal_status TEXT DEFAULT 'Pending',
  appeal_date DATETIME,
  assigned_partner_email TEXT,
  assigned_partner_at DATETIME,
  assigned_by_admin_email TEXT,
  partner_status TEXT DEFAULT 'Assigned',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO appeals_rebuilt_0023 (
  id,
  transaction_id,
  customer_id,
  customer_name,
  customer_email,
  property_address,
  property_key,
  property_pin,
  payment_intent_id,
  payment_amount,
  payment_status,
  payment_date,
  appeal_status,
  appeal_date,
  assigned_partner_email,
  assigned_partner_at,
  assigned_by_admin_email,
  partner_status,
  created_at
)
SELECT
  id,
  transaction_id,
  customer_id,
  customer_name,
  customer_email,
  property_address,
  property_key,
  property_pin,
  payment_intent_id,
  payment_amount,
  payment_status,
  CASE WHEN payment_status = 'paid' THEN created_at ELSE NULL END,
  'Pending',
  NULL,
  assigned_partner_email,
  assigned_partner_at,
  assigned_by_admin_email,
  partner_status,
  created_at
FROM appeals;

DROP TABLE appeals;

ALTER TABLE appeals_rebuilt_0023 RENAME TO appeals;
