CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  inquiry_type TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  property_address TEXT,
  insurance_types TEXT,
  message TEXT,
  email_sent INTEGER DEFAULT 0,
  email_error TEXT,
  user_agent TEXT,
  country TEXT,
  cf_ray TEXT
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at
ON contact_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_contact_messages_inquiry_type
ON contact_messages(inquiry_type);
