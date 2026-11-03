-- Composite FK checks both saved-address existence and customer ownership.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_addresses_id_customer ON user_addresses(id, customer_id);
CREATE TABLE IF NOT EXISTS self_appeal_cases (
  customer_id TEXT NOT NULL,
  address_id INTEGER NOT NULL,
  agency TEXT NOT NULL CHECK (agency IN ('assessor', 'board_of_review')),
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2020 AND 2100),
  state_json TEXT NOT NULL CHECK (json_valid(state_json) AND json_type(state_json) = 'object'),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(customer_id, address_id, agency, tax_year),
  FOREIGN KEY(address_id, customer_id) REFERENCES user_addresses(id, customer_id) ON DELETE RESTRICT
);
