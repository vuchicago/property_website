"""Real SQLite migration/constraint tests; no external database or customer data."""
import json
import sqlite3
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class PacketSchema(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript('''CREATE TABLE appeals(transaction_id TEXT NOT NULL UNIQUE, customer_id TEXT NOT NULL, payment_amount INTEGER, payment_status TEXT);
        CREATE TABLE user_addresses(id INTEGER PRIMARY KEY, customer_id TEXT NOT NULL);
        INSERT INTO user_addresses VALUES(1,'owner');
        INSERT INTO appeals VALUES('free_case','owner',0,'free');
        INSERT INTO appeals VALUES('cs_order','owner',4900,'unpaid');
        INSERT INTO appeals VALUES('cs_other','other',4900,'paid');''')
        for n in ['0029_create_appeal_packets.sql','0030_create_self_appeal_cases.sql','0031_create_packet_fulfillment.sql']:
            self.db.executescript((ROOT/'migrations'/n).read_text())
        self.state={'status':'review','version':1,'intake':{'agency':'assessor'},'documents':[{'id':'pdf','key':'private/original','version':1}]}
        self.db.execute('INSERT INTO appeal_packets(transaction_id,state_json) VALUES(?,?)',('free_case',json.dumps(self.state)))
    def approve(self):
        self.state.update(status='approved',approval={'version':1,'actor':'owner','at':'2026-11-03T12:00:00Z'})
        self.db.execute('UPDATE appeal_packets SET state_json=?, revision=revision+1 WHERE transaction_id=?',(json.dumps(self.state),'free_case'))
    def order(self):
        self.db.execute("INSERT INTO packet_fulfillment_orders(session_id,packet_id,packet_version,customer_id) VALUES('cs_order','free_case',1,'owner')")
    def sign(self):
        self.db.execute("INSERT INTO packet_signatures(packet_id,packet_version,environment,operation_id) VALUES('free_case',1,'demo','operation-1')")
    def test_snapshot_is_automatic_immutable_and_retained(self):
        self.approve()
        snapshot=self.db.execute('SELECT state_json FROM packet_versions').fetchone()[0]
        self.state.update(status='awaiting_signature')
        self.db.execute('UPDATE appeal_packets SET state_json=?',(json.dumps(self.state),))
        self.assertEqual(self.db.execute('SELECT state_json FROM packet_versions').fetchone()[0],snapshot)
        with self.assertRaises(sqlite3.IntegrityError):self.db.execute("UPDATE packet_versions SET state_json='{}'")
        with self.assertRaises(sqlite3.IntegrityError):self.db.execute('DELETE FROM packet_versions')
    def test_wrong_approver_rejected(self):
        self.state.update(status='approved',approval={'version':1,'actor':'other','at':'2026-11-03'})
        with self.assertRaises(sqlite3.IntegrityError):self.db.execute('UPDATE appeal_packets SET state_json=?',(json.dumps(self.state),))
    def test_order_requires_approved_version_and_matching_customer(self):
        with self.assertRaises(sqlite3.IntegrityError):self.order()
        self.approve();self.order()
        with self.assertRaises(sqlite3.IntegrityError):self.db.execute("INSERT INTO packet_fulfillment_orders(session_id,packet_id,packet_version,customer_id) VALUES('cs_other','free_case',1,'owner')")
        with self.assertRaises(sqlite3.IntegrityError):self.db.execute("UPDATE packet_fulfillment_orders SET customer_id='other'")
    def test_paid_before_signing_and_envelope_identity(self):
        self.approve();self.order()
        with self.assertRaises(sqlite3.IntegrityError):self.sign()
        self.db.execute("UPDATE appeals SET payment_status='paid' WHERE transaction_id='cs_order'")
        self.sign()
        self.db.execute("UPDATE packet_signatures SET status='created',envelope_id='env-1',operation_id=NULL")
        self.db.execute("UPDATE packet_signatures SET status='sent',operation_id='send-1'")
        self.db.execute("UPDATE packet_signatures SET status='completed',operation_id=NULL")
        with self.assertRaises(sqlite3.IntegrityError):self.db.execute("UPDATE packet_signatures SET environment='production'")
        with self.assertRaises(sqlite3.IntegrityError):self.db.execute("UPDATE packet_signatures SET envelope_id='env-other'")
    def test_saved_property_owner_fk_and_json(self):
        self.db.execute("INSERT INTO self_appeal_cases(customer_id,address_id,agency,tax_year,state_json) VALUES('owner',1,'assessor',2026,'{}')")
        with self.assertRaises(sqlite3.IntegrityError):self.db.execute("INSERT INTO self_appeal_cases(customer_id,address_id,agency,tax_year,state_json) VALUES('other',1,'assessor',2026,'{}')")
        with self.assertRaises(sqlite3.IntegrityError):self.db.execute('DELETE FROM user_addresses WHERE id=1')
        with self.assertRaises(sqlite3.IntegrityError):self.db.execute("UPDATE appeal_packets SET state_json='not json'")
    def test_existing_data_untouched_and_foreign_keys_clean(self):
        self.assertEqual(self.db.execute('SELECT count(*) FROM appeals').fetchone()[0],3)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])
if __name__=='__main__':unittest.main()
