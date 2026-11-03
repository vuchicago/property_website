export async function paidFulfillment(db, packetId, version, uid) {
    return db.prepare(`SELECT a.transaction_id FROM packet_fulfillment_orders f
      JOIN appeals a ON a.transaction_id = f.session_id
      WHERE f.packet_id = ? AND f.packet_version = ? AND f.customer_id = ?
      AND a.customer_id = f.customer_id AND a.payment_status = 'paid' AND a.payment_amount = 4900
      LIMIT 1`).bind(packetId, version, uid).first();
}
export const isFreePacket = id => String(id || '').startsWith('free_');
