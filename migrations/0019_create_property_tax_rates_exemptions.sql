CREATE TABLE IF NOT EXISTS property_tax_rates (
  tax_year INTEGER NOT NULL,
  tax_district_code TEXT NOT NULL,
  composite_tax_rate REAL NOT NULL,
  source TEXT,
  imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tax_year, tax_district_code)
);

CREATE INDEX IF NOT EXISTS idx_property_tax_rates_tax_code
ON property_tax_rates(tax_district_code);

CREATE TABLE IF NOT EXISTS property_tax_exemptions (
  tax_year INTEGER NOT NULL,
  pin TEXT NOT NULL,
  exemption_type TEXT NOT NULL,
  exemption_amount_eav REAL,
  source TEXT,
  imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tax_year, pin, exemption_type)
);

CREATE INDEX IF NOT EXISTS idx_property_tax_exemptions_pin_year
ON property_tax_exemptions(pin, tax_year);
