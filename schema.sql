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
  source_year INTEGER NOT NULL DEFAULT 2025,
  pin TEXT,
  address TEXT NOT NULL,
  normalized_address TEXT NOT NULL,
  house_number TEXT,
  street_name TEXT,
  street_suffix TEXT,
  unit TEXT,
  city TEXT,
  state TEXT DEFAULT 'IL',
  zip TEXT,
  township TEXT,
  property_class TEXT,
  class_code TEXT,
  taxable_value INTEGER,
  certified_land INTEGER,
  certified_building INTEGER,
  home_size REAL,
  bedroom_count REAL,
  bathroom_count REAL,
  masonry_type TEXT,
  finished_basement TEXT,
  single_vs_multi_family TEXT,
  neighborhood_code TEXT,
  garage_size TEXT,
  pin_proration_rate REAL,
  last_appeal_year TEXT,
  last_appeal_status TEXT,
  latitude REAL,
  longitude REAL,
  source_row_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_addresses_pin_year
ON property_addresses(pin, source_year)
WHERE pin IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_property_addresses_normalized
ON property_addresses(normalized_address);

CREATE INDEX IF NOT EXISTS idx_property_addresses_house_number
ON property_addresses(house_number);

CREATE INDEX IF NOT EXISTS idx_property_addresses_street_name
ON property_addresses(street_name);

CREATE INDEX IF NOT EXISTS idx_property_addresses_zip
ON property_addresses(zip);

CREATE INDEX IF NOT EXISTS idx_property_addresses_city
ON property_addresses(city);

CREATE INDEX IF NOT EXISTS idx_property_addresses_neighborhood
ON property_addresses(neighborhood_code);

CREATE INDEX IF NOT EXISTS idx_property_addresses_lat_lon
ON property_addresses(latitude, longitude);
