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
