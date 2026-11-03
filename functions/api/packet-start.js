import { requireFirebaseUser, jsonResponse } from './_auth.js';
import { propertySnapshot } from './_packet_preparation.js';
import { initialPacket } from './_packet_workflow.js';
export async function onRequestPost({request, env}) {
    const {user,response} = await requireFirebaseUser(request);
    if (response) return response;
    try {
        if (!env.DB) return jsonResponse({error:'Database is not configured.'},503);
        const {propertyId, taxYear = new Date().getUTCFullYear()} = await request.json();
        if (!Number.isInteger(taxYear) || taxYear < 2020 || taxYear > new Date().getUTCFullYear()+1) return jsonResponse({error:"Choose an assessment year."},400);
        if (!Number.isInteger(propertyId) || propertyId < 1) return jsonResponse({error:'Choose a saved property.'},400);
        const property = await env.DB.prepare('SELECT id, address, property_key FROM user_addresses WHERE id = ? AND customer_id = ?').bind(propertyId,user.uid).first();
        if (!property) return jsonResponse({error:'Saved property not found.'},404);
        const existing = await env.DB.prepare(`SELECT a.transaction_id, p.state_json, p.revision FROM appeals a JOIN appeal_packets p ON p.transaction_id = a.transaction_id WHERE a.customer_id = ? AND a.property_key = ? AND a.payment_status = 'free' AND COALESCE(json_extract(p.state_json, '$.intake.taxYear'), json_extract(p.state_json, '$.taxYear')) = ? LIMIT 1`).bind(user.uid,property.property_key,taxYear).first();
        if(existing) {
            const state=JSON.parse(existing.state_json);
            if(!state.propertySnapshot && ['intake','preparing'].includes(state.status)) {
                state.propertySnapshot=await propertySnapshot({request,env},propertyId);
                state.taxYear=taxYear;
                await env.DB.prepare('UPDATE appeal_packets SET state_json = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE transaction_id = ? AND revision = ?').bind(JSON.stringify(state),existing.transaction_id,existing.revision).run();
            }
            return jsonResponse({id:existing.transaction_id,url:`/appeal-packet.html?id=${encodeURIComponent(existing.transaction_id)}`});
        }
        const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([user.uid,propertyId,taxYear])));
        const id = `free_${Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')}`;
        const snapshot=await propertySnapshot({request,env},propertyId);
        await env.DB.batch([
            env.DB.prepare(`INSERT OR IGNORE INTO appeals (transaction_id, customer_id, customer_email, property_address, property_key, payment_amount, payment_status, appeal_status)
              VALUES (?, ?, ?, ?, ?, 0, 'free', 'Pending')`).bind(id,user.uid,user.email,property.address,property.property_key || null),
            env.DB.prepare('INSERT OR IGNORE INTO appeal_packets (transaction_id, state_json) VALUES (?, ?)').bind(id,JSON.stringify({...initialPacket(),taxYear,propertySnapshot:snapshot,service:'assessor_self_service',signatureAcceptance:'assumed_unverified'}))
        ]);
        return jsonResponse({id,url:`/appeal-packet.html?id=${encodeURIComponent(id)}`});
    } catch (error) {
        console.error('Free packet creation failed:',error.message);
        return jsonResponse({error:error.status ? error.message : 'Could not create your free workspace. Please try again.'},error.status || 503);
    }
}
