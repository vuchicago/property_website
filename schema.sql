DROP TABLE IF EXISTS appeals;
CREATE TABLE appeals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL,
  customer_email TEXT,
  property_address TEXT,
  payment_amount INTEGER,
  payment_status TEXT,
  payment_date DATETIME,
  appeal_status TEXT DEFAULT 'Pending',
  appeal_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
    email TEXT PRIMARY KEY,
    role TEXT NOT NULL
);

INSERT OR IGNORE INTO admins (email, role) VALUES ('vu@cookcountytaxcompare.com', 'superadmin');

CREATE TABLE IF NOT EXISTS user_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, address)
);
