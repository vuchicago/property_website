import { requireFirebaseUser, jsonResponse } from './_auth.js';
import { initialPacket } from './_packet_workflow.js';
export async function onRequestPost({request, env}) {
    const {user,response} = await requireFirebaseUser(request);
    if (response) return response;
    try {
        if (!env.DB) return jsonResponse({error:'Database is not configured.'},503);
        const {propertyId} = await request.json();
        if (!Number.isInteger(propertyId) || propertyId < 1) return jsonResponse({error:'Choose a saved property.'},400);
        const property = await env.DB.prepare('SELECT id, address, property_key FROM user_addresses WHERE id = ? AND customer_id = ?').bind(propertyId,user.uid).first();
        if (!property) return jsonResponse({error:'Saved property not found.'},404);
        const id = `free_${crypto.randomUUID()}`;
        await env.DB.batch([
            env.DB.prepare(`INSERT INTO appeals (transaction_id, customer_id, customer_email, property_address, property_key, payment_amount, payment_status, appeal_status)
              VALUES (?, ?, ?, ?, ?, 0, 'free', 'Pending')`).bind(id,user.uid,user.email,property.address,property.property_key || null),
            env.DB.prepare('INSERT INTO appeal_packets (transaction_id, state_json) VALUES (?, ?)').bind(id,JSON.stringify({...initialPacket(),service:'assessor_self_service',signatureAcceptance:'assumed_unverified'}))
        ]);
        return jsonResponse({id,url:`/appeal-packet.html?id=${encodeURIComponent(id)}`});
    } catch (error) {
        console.error('Free packet creation failed:',error.message);
        return jsonResponse({error:'Could not create your free workspace. The packet database must be configured.'},503);
    }
}
