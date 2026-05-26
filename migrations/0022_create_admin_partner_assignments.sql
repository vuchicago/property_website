INSERT OR IGNORE INTO admins (email, role) VALUES ('vuchicago@gmail.com', 'superadmin');

UPDATE admins
SET role = 'admin'
WHERE lower(email) = 'vu@cookcountytaxcompare.com'
  AND lower(email) <> 'vuchicago@gmail.com';

ALTER TABLE appeals ADD COLUMN assigned_partner_email TEXT;
ALTER TABLE appeals ADD COLUMN assigned_partner_at DATETIME;
ALTER TABLE appeals ADD COLUMN assigned_by_admin_email TEXT;
ALTER TABLE appeals ADD COLUMN partner_status TEXT DEFAULT 'Assigned';

CREATE TABLE IF NOT EXISTS account_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_email TEXT NOT NULL,
  recipient_role TEXT NOT NULL,
  appeal_id INTEGER,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_account_notifications_recipient
ON account_notifications(recipient_email, is_read, created_at);
