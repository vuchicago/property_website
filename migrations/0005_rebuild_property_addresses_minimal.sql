DROP TABLE IF EXISTS property_addresses;

CREATE TABLE property_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pin TEXT,
  address TEXT NOT NULL,
  normalized_address TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_addresses_pin
ON property_addresses(pin)
WHERE pin IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_property_addresses_normalized
ON property_addresses(normalized_address);
