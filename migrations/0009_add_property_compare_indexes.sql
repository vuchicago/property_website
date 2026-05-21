CREATE INDEX IF NOT EXISTS idx_property_addresses_lookup_geo
ON property_addresses(neighborhood_code, class_code, latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_property_addresses_residential_match
ON property_addresses(class_code, neighborhood_code, home_size, year_built, repair_condition, latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_property_addresses_condo_match
ON property_addresses(class_code, pin10, home_size, bedroom_count, bathroom_count, latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_property_addresses_normalized
ON property_addresses(normalized_address);
