import { assemblePacket } from './_packet_pdf.js';
import { evidenceCategories } from '../../packet-requirements.js';
import { requireFirebaseUser } from './_auth.js';
import { paidFulfillment, isFreePacket } from './_fulfillment.js';
import { initialPacket, transitionPacket } from './_packet_workflow.js';
import { appealAccess } from './_appeal_access.js';
import { packetMailingWindow, requireOpenMailingWindow } from './_packet_mailing.js';
import { officialFormsStatus } from './_official_forms.js';
import { checkoutAccess } from './_checkout_access.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const FILE_ACTIONS = new Set(['evidence', 'packet', 'signed_packet', 'certificate', 'mail', 'delivered', 'filed']);
const MAX_FILE_SIZE = 15 * 1024 * 1024;

async function boundedRequest(request) {
    const reader = request.body?.getReader();
    if (!reader) throw Object.assign(new Error('Request body is required.'), { status: 400 });
    const chunks = [];
    let size = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_FILE_SIZE + 65536) {
            await reader.cancel();
            throw Object.assign(new Error('Maximum upload size is 15 MB.'), { status: 413 });
        }
        chunks.push(value);
    }
    return new Request(request.url, { method: 'POST', headers: request.headers, body: new Blob(chunks) });
}

export async function onRequest(context) {
    let storedKey = null;
    let committed = false;
    try {
        if (!['GET', 'POST'].includes(context.request.method)) return json({ error: 'Method not allowed' }, 405);
        const { user, response } = await requireFirebaseUser(context.request);
        if (response) return response;
        const db = context.env.DB;
        if (!db) return json({ error: 'Database is not configured.' }, 503);
        const url = new URL(context.request.url);
        let transactionId = url.searchParams.get('id');
        if(transactionId && !isFreePacket(transactionId)) {
            const mapped=await db.prepare('SELECT packet_id FROM packet_fulfillment_orders WHERE session_id = ?').bind(transactionId).first();
            if(mapped)transactionId=mapped.packet_id;
        }
        if (!transactionId || transactionId.length > 255) return json({ error: 'Select a packet workspace.' }, 400);
        const appeal = await db.prepare('SELECT transaction_id, customer_id, customer_name, customer_email, property_address, property_pin, payment_status, appeal_status FROM appeals WHERE transaction_id = ?').bind(transactionId).first();
        if (!appeal) return json({ error: 'Order not found.' }, 404);
        const role = await db.prepare("SELECT role FROM admins WHERE lower(email) = ? AND role IN ('admin', 'superadmin')").bind((user.email || '').toLowerCase()).first();
        const actor = { uid: user.uid, isOwner: appeal.customer_id === user.uid, isAdmin: Boolean(role) };
        if (!actor.isOwner && !actor.isAdmin) return json({ error: 'Order not found.' }, 404);
        if(appeal.appeal_status==='Payment Test')return json({error:'This is a payment-test receipt, not a fulfillment packet. Open your original property workspace in My account.'},409);
        const row = await db.prepare('SELECT revision, state_json FROM appeal_packets WHERE transaction_id = ?').bind(transactionId).first();
        const state = row ? JSON.parse(row.state_json) : initialPacket();
        const revision = row?.revision || 0;
        const free = isFreePacket(transactionId);
        actor.freePacket = free;
        const fulfillment = free ? await paidFulfillment(db,transactionId,state.version,appeal.customer_id) : null;
        const signature = free ? await db.prepare('SELECT envelope_id, status, environment FROM packet_signatures WHERE packet_id = ? AND packet_version = ?').bind(transactionId,state.version).first() : null;
        if (free && !fulfillment && !(await appealAccess(db,user)).allowed) return json({error:'Free appeal testing is currently by invitation. You can join the public waitlist.'},403);

        if (context.request.method === 'GET') {
            const documentId = url.searchParams.get('document');
            if (documentId) {
                const doc = state.documents.find(item => item.id === documentId);
                if (!doc) return json({ error: 'Document not found.' }, 404);
                if (!context.env.APPEAL_PACKETS) return json({ error: 'Private document storage is not configured.' }, 503);
                const object = await context.env.APPEAL_PACKETS.get(doc.key);
                if (!object) return json({ error: 'Document not found.' }, 404);
                return new Response(object.body, { headers: { 'Content-Type': doc.type, 'Content-Disposition': `attachment; filename="${doc.name}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
            }
            if(url.searchParams.get('download')==='preparation') {
                if(!free)return json({error:'Choose a self-service appeal packet.'},400);
                if(!context.env.APPEAL_PACKETS)return json({error:'Private document storage is not configured.'},503);
                const bytes=await assemblePacket(state,appeal,context.env.APPEAL_PACKETS,{preparationCopy:true});
                const year=state.intake?.taxYear || state.taxYear || 'draft';
                return new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="assessor-${year}-preparation-copy.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
            }
            const events = row ? await db.prepare("SELECT action, status, created_at FROM appeal_packet_events WHERE transaction_id = ? AND action <> 'questionnaire' ORDER BY created_at DESC, rowid DESC LIMIT 100").bind(transactionId).all() : { results: [] };
            const officialForms=free?await officialFormsStatus(context.env.APPEAL_PACKETS,state,appeal).catch(()=>null):null;
            const checkout=free?await checkoutAccess(context.env,user).catch(()=>({enabled:false,testing:false})):null;
            return json({ packetId: transactionId, fulfillmentPaid: Boolean(fulfillment), signature, appeal, officialForms, checkout, state: { ...state, documents: state.documents.map(({ key, ...doc }) => doc) }, mailingWindow: free ? packetMailingWindow(state) : null, revision, isOwner: actor.isOwner, isAdmin: actor.isAdmin, storageReady: Boolean(context.env.APPEAL_PACKETS), events: events.results });
        }

        // Payment is trusted only from the server's Stripe-backed order record.
        if (!free && appeal.payment_status !== 'paid') return json({ error: 'A confirmed payment is required. Refunded or unpaid orders cannot be changed.' }, 402);
        if (Number(context.request.headers.get('content-length')) > MAX_FILE_SIZE + 65536) return json({ error: 'Maximum upload size is 15 MB.' }, 413);
        let input, file;
        const bodyRequest = await boundedRequest(context.request);
        if ((context.request.headers.get('content-type') || '').startsWith('multipart/form-data')) {
            const form = await bodyRequest.formData();
            input = JSON.parse(String(form.get('data') || '{}')); file = form.get('file');
        } else {
            input = await bodyRequest.json();
        }
        if (!input || typeof input !== 'object' || Array.isArray(input)) return json({ error: 'Invalid request.' }, 400);
        if (free && ['request_signature','signed_packet','certificate','confirm_signed'].includes(input.action)) return json({error:'Use the integrated DocuSign workflow.'},400);
        if (signature && input.action === 'revise' && signature.status !== 'voided') return json({error:'Void the DocuSign envelope through the signing service before revising.'},409);
        if (free && ['mail','delivered','filed'].includes(input.action) && !fulfillment) return json({error:'Paid fulfillment for this packet version is required.'},402);
        if (free && input.action === 'mail' && signature?.environment !== 'production') return json({error:'Demo signatures cannot be used for real mailing.'},409);
        if (free && input.action === 'mail') requireOpenMailingWindow(state);
        if (input.revision !== revision) return json({ error: 'This case changed. Refresh before saving.' }, 409);
        // Never accept a client-provided object key or document metadata.
        delete input.document;
        let bytes;
        if(input.action === 'generate') {
            if(!actor.isOwner || state.status !== 'preparing') return json({error:'Save your information before building the packet.'},400);
            if(!context.env.APPEAL_PACKETS) return json({error:'Private document storage is not configured.'},503);
            bytes = await assemblePacket(state,appeal,context.env.APPEAL_PACKETS);
            input.action='packet';
            file=new File([bytes],`assessor-${state.intake.taxYear}-packet.pdf`,{type:'application/pdf'});
        }
        if (FILE_ACTIONS.has(input.action)) {
            if (!context.env.APPEAL_PACKETS) return json({ error: 'Private document storage must be configured before uploading.' }, 503);
            if (!file || typeof file.arrayBuffer !== 'function' || !file.size || file.size > MAX_FILE_SIZE) return json({ error: 'Choose a PDF or evidence image up to 15 MB.' }, 400);
            bytes = new Uint8Array(await file.arrayBuffer());
            const pdf = new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
            const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
            const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
            const type = pdf ? 'application/pdf' : png ? 'image/png' : jpeg ? 'image/jpeg' : null;
            if (!type || (input.action !== 'evidence' && !pdf)) return json({ error: 'Packet, signature, and mailing records must be PDFs. Evidence may also be JPG or PNG.' }, 400);
            const id = crypto.randomUUID();
            input.document = { id, key: `packets/${transactionId}/${id}`, name: String(file.name).replace(/[^\w.() -]/g, '_').slice(0, 160) || 'document.pdf', type, size: bytes.length, kind: input.action === 'mail' ? 'mailing_proof' : input.action === 'filed' ? 'filing_receipt' : input.action === 'delivered' ? 'delivery_proof' : input.action, version: state.version + (input.action === 'packet' ? 1 : 0), uploadedAt: new Date().toISOString() };
        }
        if(input.action === 'evidence') {
            if(!evidenceCategories[input.category]) return json({error:'Choose the type of evidence.'},400);
            if(input.category==='application' && input.document.type!=='application/pdf') return json({error:'Upload the completed application as a PDF.'},400);
            if(input.category==='photo' && (!/^\d{4}-\d{2}-\d{2}$/.test(input.photoDate||'') || !Number.isFinite(Date.parse(input.photoDate)) || new Date(input.photoDate).toISOString().slice(0,10)!==input.photoDate || input.photoDate > new Date().toISOString().slice(0,10))) return json({error:'Enter the actual date the photograph was taken.'},400);
            input.document.category=input.category;
            if(input.category==='photo')input.document.photoDate=input.photoDate;
            if(input.category==='photo')input.document.dateStamped=input.photoDateStamped===true || input.photoDateStamped==='yes';
        }
        if (free && input.action === 'revise' && signature?.status === 'voided') input.envelopeVoided = true;
        const next = transitionPacket(state, input, actor);
        if(input.action==='questionnaire' && state.questionnaire?.step===next.questionnaire.step) {
            const canonical=answers=>JSON.stringify(Object.entries(answers).sort(([a],[b])=>a.localeCompare(b)));
            if(canonical(state.questionnaire.answers)===canonical(next.questionnaire.answers))return json({success:true,revision,questionnaire:state.questionnaire});
        }
        if (bytes) {
            storedKey = input.document.key;
            await context.env.APPEAL_PACKETS.put(storedKey, bytes, { httpMetadata: { contentType: input.document.type } });
        }
        const eventId = crypto.randomUUID();
        const fulfillmentGuard = free && ['mail','delivered','filed'].includes(input.action)
            ? ` AND EXISTS (SELECT 1 FROM packet_fulfillment_orders f JOIN appeals a ON a.transaction_id = f.session_id WHERE f.packet_id = appeal_packets.transaction_id AND f.packet_version = ${state.version} AND a.payment_status = 'paid' AND a.payment_amount = 4900)` : '';
        const signingGuard = free && input.action === 'revise'
            ? ` AND NOT EXISTS (SELECT 1 FROM packet_signatures s WHERE s.packet_id = appeal_packets.transaction_id AND s.packet_version = ${state.version} AND s.status != 'voided')` : '';
        // Progress stays in the working state; only substantive actions add activity events.
        // The conditional update and any event insert remain one atomic D1 batch.
        const statements = [
            db.prepare('INSERT OR IGNORE INTO appeal_packets (transaction_id, state_json) VALUES (?, ?)').bind(transactionId, JSON.stringify(initialPacket())),
            db.prepare('UPDATE appeal_packets SET state_json = ?, revision = revision + 1, last_event_id = ?, updated_at = CURRENT_TIMESTAMP WHERE transaction_id = ? AND revision = ? AND EXISTS (SELECT 1 FROM appeals WHERE transaction_id = ? AND payment_status = ?)' + fulfillmentGuard + signingGuard).bind(JSON.stringify(next), eventId, transactionId, revision, transactionId, free ? 'free' : 'paid')
        ];
        if(input.action!=='questionnaire')statements.push(db.prepare('INSERT INTO appeal_packet_events (id, transaction_id, actor_id, action, status) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM appeal_packets WHERE transaction_id = ? AND last_event_id = ?)').bind(eventId, transactionId, user.uid, input.action, next.status, transactionId, eventId));
        const result = await db.batch(statements);
        if (!result[1].meta?.changes) return json({ error: 'The case or payment changed. Refresh before saving.' }, 409);
        committed = true;
        return json({ success: true, revision:revision+1, ...(input.action==='questionnaire'?{questionnaire:next.questionnaire}:{}) });
    } catch (error) {
        console.error('Packet workflow failed:', error.message);
        return json({ error: error.status ? error.message : 'Unable to save or load the packet. Confirm the database migration and private storage are configured.' }, error.status || 500);
    } finally {
        if (storedKey && !committed) await context.env.APPEAL_PACKETS.delete(storedKey).catch(() => {});
    }
}
