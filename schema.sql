DROP TABLE IF EXISTS appeals;
CREATE TABLE appeals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL,
  customer_name TEXT,
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
  email TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, address)
);

CREATE TABLE IF NOT EXISTS property_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pin TEXT,
  address TEXT NOT NULL,
  normalized_address TEXT NOT NULL,
  taxable_value INTEGER,
  last_appeal_year TEXT,
  certified_land INTEGER,
  certified_building INTEGER,
  home_size REAL,
  last_appeal_status TEXT,
  bedroom_count REAL,
  bathroom_count REAL,
  masonry_type TEXT,
  finished_basement TEXT,
  single_vs_multi_family TEXT,
  neighborhood_code TEXT,
  garage_size TEXT,
  property_class TEXT,
  pin_proration_rate REAL,
  latitude REAL,
  longitude REAL,
  latitude_raw TEXT,
  longitude_raw TEXT,
  class_code TEXT
);
