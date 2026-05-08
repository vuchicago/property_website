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

CREATE TABLE IF NOT EXISTS property_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL,
  property_pin TEXT NOT NULL,
  property_address TEXT,
  image_data TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_property_images_user_pin
ON property_images(customer_id, property_pin);

CREATE TABLE IF NOT EXISTS property_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  searched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  query_address TEXT,
  matched_address TEXT NOT NULL,
  pin TEXT,
  result TEXT,
  reason TEXT,
  radius REAL,
  comp_count INTEGER,
  lower_value_count INTEGER,
  last_appeal TEXT,
  property_type TEXT,
  home_size REAL,
  bedroom_count REAL,
  bathroom_count REAL,
  my_value REAL,
  avg_comp_value REAL,
  class_code TEXT,
  neighborhood_code TEXT,
  device TEXT,
  user_agent TEXT,
  country TEXT,
  cf_ray TEXT
);

CREATE INDEX IF NOT EXISTS idx_property_searches_searched_at
ON property_searches(searched_at);

CREATE INDEX IF NOT EXISTS idx_property_searches_pin
ON property_searches(pin);
