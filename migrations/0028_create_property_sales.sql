CREATE TABLE IF NOT EXISTS property_sales (
  row_id TEXT PRIMARY KEY,
  pin TEXT NOT NULL,
  pin10 TEXT,
  sale_year INTEGER,
  township_code TEXT,
  neighborhood_code TEXT,
  class_code TEXT,
  sale_date TEXT,
  sale_price REAL,
  sale_document_num TEXT,
  sale_deed_type TEXT,
  mydec_deed_type TEXT,
  sale_seller_name TEXT,
  is_multisale INTEGER,
  num_parcels_sale INTEGER,
  sale_buyer_name TEXT,
  sale_type TEXT,
  sale_filter_same_sale_within_365 INTEGER,
  sale_filter_less_than_10k INTEGER,
  sale_filter_deed_type INTEGER,
  imported_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_property_sales_pin_date
ON property_sales(pin, sale_date);

CREATE INDEX IF NOT EXISTS idx_property_sales_pin10_date
ON property_sales(pin10, sale_date);

CREATE INDEX IF NOT EXISTS idx_property_sales_doc
ON property_sales(sale_document_num);
