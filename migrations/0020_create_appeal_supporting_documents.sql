CREATE TABLE IF NOT EXISTS appeal_supporting_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL,
  property_pin TEXT NOT NULL,
  property_address TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_data TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_appeal_supporting_documents_user_pin
ON appeal_supporting_documents(customer_id, property_pin, uploaded_at);
