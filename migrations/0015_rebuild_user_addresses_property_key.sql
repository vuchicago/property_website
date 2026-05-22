ALTER TABLE user_addresses RENAME TO user_addresses_old;

CREATE TABLE user_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL,
  address TEXT NOT NULL,
  property_key TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, property_key)
);

INSERT OR IGNORE INTO user_addresses (id, customer_id, address, property_key, email, created_at)
SELECT id, customer_id, address, address, email, created_at
FROM user_addresses_old;

UPDATE user_addresses
SET property_key = (
  SELECT CASE
           WHEN pin_proration_rate IS NOT NULL AND pin_proration_rate < 1
           THEN normalized_address || '|fractional'
           ELSE normalized_address || '|pin:' || COALESCE(pin, id)
         END
  FROM property_addresses
  WHERE property_addresses.address = user_addresses.address
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM property_addresses
  WHERE property_addresses.address = user_addresses.address
);

DROP TABLE user_addresses_old;
