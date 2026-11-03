-- Additive workflow storage. Existing appeals/payment rows are not rebuilt.
CREATE TABLE IF NOT EXISTS appeal_packets (
  transaction_id TEXT NOT NULL PRIMARY KEY REFERENCES appeals(transaction_id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  state_json TEXT NOT NULL CHECK (json_valid(state_json) AND json_type(state_json) = 'object'),
  last_event_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS appeal_packet_events (
  id TEXT NOT NULL PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES appeal_packets(transaction_id) ON DELETE RESTRICT,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_packet_events_case ON appeal_packet_events(transaction_id, created_at);

-- Retain the owner-approved input even after the working state moves to signing,
-- mailing, or a later version. PDF bytes remain private R2 objects, not SQL blobs.
CREATE TABLE IF NOT EXISTS packet_versions (
  packet_id TEXT NOT NULL REFERENCES appeal_packets(transaction_id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  state_json TEXT NOT NULL CHECK (json_valid(state_json) AND json_type(state_json) = 'object'),
  approved_by TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (packet_id, version),
  CHECK (json_extract(state_json, '$.version') IS version),
  CHECK (json_extract(state_json, '$.approval.version') IS version),
  CHECK (json_extract(state_json, '$.status') IS 'approved')
);
CREATE TRIGGER IF NOT EXISTS packet_versions_snapshot
AFTER UPDATE OF state_json ON appeal_packets
WHEN json_extract(NEW.state_json, '$.status') = 'approved'
 AND json_extract(NEW.state_json, '$.approval.version') = json_extract(NEW.state_json, '$.version')
BEGIN
  INSERT INTO packet_versions (packet_id, version, state_json, approved_by, approved_at)
  VALUES (NEW.transaction_id, json_extract(NEW.state_json, '$.version'), NEW.state_json,
          json_extract(NEW.state_json, '$.approval.actor'), json_extract(NEW.state_json, '$.approval.at'))
  ON CONFLICT(packet_id, version) DO NOTHING;
END;
CREATE TRIGGER IF NOT EXISTS packet_versions_owner
BEFORE INSERT ON packet_versions
WHEN NOT EXISTS (SELECT 1 FROM appeals WHERE transaction_id = NEW.packet_id AND customer_id = NEW.approved_by)
BEGIN
  SELECT RAISE(ABORT, 'Approved packet must belong to approving owner');
END;
CREATE TRIGGER IF NOT EXISTS packet_versions_immutable_update
BEFORE UPDATE ON packet_versions
BEGIN
  SELECT RAISE(ABORT, 'Approved packet versions are immutable');
END;
CREATE TRIGGER IF NOT EXISTS packet_versions_immutable_delete
BEFORE DELETE ON packet_versions
BEGIN
  SELECT RAISE(ABORT, 'Approved packet versions are retained');
END;
