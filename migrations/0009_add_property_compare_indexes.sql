CREATE INDEX IF NOT EXISTS idx_property_addresses_lookup_geo
ON property_addresses(neighborhood_code, class_code, latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_property_addresses_normalized
ON property_addresses(normalized_address);
