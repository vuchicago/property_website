-- A checkout attempt is distinct from a packet. Stripe payment state stays in
-- appeals; retries may have separate sessions, all tied to an approved version.
CREATE TABLE IF NOT EXISTS packet_fulfillment_orders (
  session_id TEXT NOT NULL PRIMARY KEY REFERENCES appeals(transaction_id) ON DELETE RESTRICT,
  packet_id TEXT NOT NULL,
  packet_version INTEGER NOT NULL CHECK (packet_version > 0),
  customer_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 4900 CHECK (amount_cents = 4900),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency = 'usd'),
  service_type TEXT NOT NULL DEFAULT 'assessor_print_mail' CHECK (service_type = 'assessor_print_mail'),
  terms_version TEXT NOT NULL DEFAULT '2026-11-03-fulfillment',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(packet_id, packet_version) REFERENCES packet_versions(packet_id, version) ON DELETE RESTRICT,
  CHECK (session_id != packet_id)
);
CREATE INDEX IF NOT EXISTS idx_fulfillment_packet ON packet_fulfillment_orders(packet_id, packet_version, customer_id);
CREATE TRIGGER IF NOT EXISTS packet_fulfillment_owner
BEFORE INSERT ON packet_fulfillment_orders
WHEN NOT EXISTS (
  SELECT 1 FROM appeals p JOIN appeals a ON a.transaction_id = NEW.session_id
  JOIN packet_versions v ON v.packet_id = p.transaction_id AND v.version = NEW.packet_version
  WHERE p.transaction_id = NEW.packet_id AND p.customer_id = NEW.customer_id
    AND a.customer_id = NEW.customer_id AND a.payment_amount = NEW.amount_cents
    AND json_extract(v.state_json, '$.intake.agency') = 'assessor'
)
BEGIN
  SELECT RAISE(ABORT, 'Fulfillment must match the packet owner, Assessor version and amount');
END;
CREATE TRIGGER IF NOT EXISTS packet_fulfillment_immutable
BEFORE UPDATE ON packet_fulfillment_orders
BEGIN
  SELECT RAISE(ABORT, 'Fulfillment order linkage is immutable; payment state is held in appeals');
END;

CREATE TABLE IF NOT EXISTS packet_signatures (
  packet_id TEXT NOT NULL,
  packet_version INTEGER NOT NULL CHECK (packet_version > 0),
  envelope_id TEXT,
  status TEXT NOT NULL DEFAULT 'creating' CHECK (status IN ('creating','created','send_uncertain','sent','delivered','signed','completed','declined','voided','deleted','processing','correct')),
  environment TEXT NOT NULL CHECK (environment IN ('demo','production')),
  operation_id TEXT,
  last_checked_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(packet_id, packet_version),
  FOREIGN KEY(packet_id, packet_version) REFERENCES packet_versions(packet_id, version) ON DELETE RESTRICT,
  UNIQUE(environment, envelope_id),
  CHECK (status != 'creating' OR (operation_id IS NOT NULL AND envelope_id IS NULL)),
  CHECK (status = 'creating' OR envelope_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_packet_signature_operation ON packet_signatures(operation_id) WHERE operation_id IS NOT NULL;
CREATE TRIGGER IF NOT EXISTS packet_signatures_paid
BEFORE INSERT ON packet_signatures
WHEN NOT EXISTS (
  SELECT 1 FROM packet_fulfillment_orders f JOIN appeals a ON a.transaction_id = f.session_id
  WHERE f.packet_id = NEW.packet_id AND f.packet_version = NEW.packet_version
    AND a.customer_id = f.customer_id AND a.payment_status = 'paid' AND a.payment_amount = f.amount_cents
)
BEGIN
  SELECT RAISE(ABORT, 'Confirmed fulfillment payment is required before creating a signing record');
END;
CREATE TRIGGER IF NOT EXISTS packet_signatures_identity
BEFORE UPDATE ON packet_signatures
WHEN NEW.packet_id != OLD.packet_id OR NEW.packet_version != OLD.packet_version OR NEW.environment != OLD.environment
 OR (OLD.envelope_id IS NOT NULL AND NEW.envelope_id IS NOT OLD.envelope_id)
BEGIN
  SELECT RAISE(ABORT, 'Envelope identity and packet version cannot be reassigned');
END;
