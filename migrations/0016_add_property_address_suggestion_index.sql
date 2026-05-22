CREATE INDEX IF NOT EXISTS idx_property_addresses_suggest_normalized
ON property_addresses(normalized_address, pin);
