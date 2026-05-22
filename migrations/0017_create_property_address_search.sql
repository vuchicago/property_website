DROP TABLE IF EXISTS property_address_search;

CREATE TABLE property_address_search (
  property_key TEXT PRIMARY KEY,
  id INTEGER,
  pin TEXT,
  address TEXT NOT NULL,
  normalized_address TEXT NOT NULL,
  mailing_name TEXT,
  pin_proration_rate REAL
);

INSERT INTO property_address_search (
  property_key,
  id,
  pin,
  address,
  normalized_address,
  mailing_name,
  pin_proration_rate
)
SELECT
  property_key,
  MIN(id) AS id,
  group_concat(pin, ', ') AS pin,
  MIN(address) AS address,
  MIN(normalized_address) AS normalized_address,
  MAX(mailing_name) AS mailing_name,
  MAX(pin_proration_rate) AS pin_proration_rate
FROM (
  SELECT
    id,
    pin,
    address,
    normalized_address,
    mailing_name,
    pin_proration_rate,
    CASE
      WHEN pin_proration_rate IS NOT NULL AND pin_proration_rate < 1
      THEN normalized_address || '|fractional'
      ELSE normalized_address || '|pin:' || COALESCE(pin, id)
    END AS property_key
  FROM property_addresses
  WHERE normalized_address IS NOT NULL
    AND normalized_address != ''
)
GROUP BY property_key;

CREATE INDEX IF NOT EXISTS idx_property_address_search_normalized
ON property_address_search(normalized_address);

CREATE INDEX IF NOT EXISTS idx_property_address_search_pin
ON property_address_search(pin);
