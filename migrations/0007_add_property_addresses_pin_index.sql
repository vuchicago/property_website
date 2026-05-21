CREATE INDEX IF NOT EXISTS idx_property_addresses_pin
ON property_addresses(pin)
WHERE pin IS NOT NULL;
