import {requireFirebaseUser,jsonResponse} from './_auth.js';
import {paidFulfillment,isFreePacket} from './_fulfillment.js';
import {docusignClient,signatureTabs} from './_docusign.js';
const error=(message,status=400)=>Object.assign(new Error(message),{status});
export async function onRequestPost({request,env}) {
    const {user,response}=await requireFirebaseUser(request);if(response)return response;
    let lock,packetId,version;
    try {
        const input=await request.json();packetId=input.packetId;
        if(!isFreePacket(packetId))throw error('Choose a self-service packet.');
        const appeal=await env.DB.prepare('SELECT * FROM appeals WHERE transaction_id = ?').bind(packetId).first();
        const role=await env.DB.prepare("SELECT role FROM admins WHERE lower(email) = ? AND role IN ('admin','superadmin')").bind(user.email.toLowerCase()).first();
        const owner=appeal?.customer_id===user.uid;
        if(!appeal || (!owner&&!role))throw error('Packet not found.',404);
        if(!role && input.action!=='sync')throw error('Only the fulfillment administrator can prepare or send signing invitations.',403);
        if(!['create','recover','send','sync','void'].includes(input.action))throw error('Unknown signing action.');
        const row=await env.DB.prepare('SELECT revision, state_json FROM appeal_packets WHERE transaction_id = ?').bind(packetId).first();
        const state=row&&JSON.parse(row.state_json);version=state?.version;
        if(state && !['approved','awaiting_signature','signed'].includes(state.status))throw error('Signing actions are unavailable after dispatch or before approval.',409);
        if(!state || state.intake?.agency!=='assessor')throw error('An Assessor packet is required.');
        if(input.revision!==row.revision)throw error('Packet changed. Refresh before continuing.',409);
        if(!env.APPEAL_PACKETS)throw error('Private document storage is required.',503);
        const paid=await paidFulfillment(env.DB,packetId,version,appeal.customer_id);
        if(!paid && input.action!=='void')throw error('Purchase $49 fulfillment before DocuSign signing.',402);
        let signature=await env.DB.prepare('SELECT * FROM packet_signatures WHERE packet_id = ? AND packet_version = ?').bind(packetId,version).first();
        if(input.action==='create') {
            if(state.status!=='approved' || state.approval?.version!==version)throw error('The owner must approve this packet version first.',409);
            if(signature)throw error('Signing already started. Recover or use the existing envelope.',409);
            if(input.noNotaryRequired!==true || input.placementReviewed!==true)throw error('Review every signature position and confirm that this packet requires no notarization. Notarial packets need a separate workflow.');
            const tabs=signatureTabs(input.positions);
            const packet=state.documents.find(d=>d.id===state.packetId&&d.version===version&&d.kind==='packet');
            const object=packet&&await env.APPEAL_PACKETS.get(packet.key);
            if(!object)throw error('Approved packet PDF is missing.');
            const client=await docusignClient(env);
            if(!await paidFulfillment(env.DB,packetId,version,appeal.customer_id))throw error('Fulfillment payment is no longer valid.',402);
            const operation=crypto.randomUUID();
            const inserted=await env.DB.prepare(`INSERT OR IGNORE INTO packet_signatures (packet_id, packet_version, environment, operation_id)
              SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM appeal_packets WHERE transaction_id = ? AND revision = ?)`)
              .bind(packetId,version,client.mode,operation,packetId,row.revision).run();
            if(!inserted.meta?.changes)throw error('Signing already started or the packet changed.',409);
            // Persist the transaction ID BEFORE contacting DocuSign. An uncertain response
            // is recovered by that ID, never by creating a second envelope blindly.
            const bytes=new Uint8Array(await new Response(object.body).arrayBuffer());
            const created=await client.call('/envelopes','POST',{transactionId:operation,status:'created',emailSubject:'Sign your Cook County Assessor appeal',
                documents:[{documentBase64:client.encodePDF(bytes),name:`Assessor packet v${version}.pdf`,fileExtension:'pdf',documentId:'1'}],
                recipients:{signers:[{email:appeal.customer_email,name:state.intake.ownerName,recipientId:'1',routingOrder:'1',tabs:{signHereTabs:tabs}}]}});
            if(!created.envelopeId)throw error('DocuSign envelope ID missing; recover this request.',502);
            await env.DB.prepare("UPDATE packet_signatures SET envelope_id = ?, status = 'created', operation_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE packet_id = ? AND packet_version = ? AND operation_id = ?").bind(created.envelopeId,packetId,version,operation).run();
            return jsonResponse({success:true,message:'Demo envelope drafted. Preview all tabs in DocuSign before sending. No signing invitation has been sent.'});
        }
        if(!signature)throw error('Create a signing envelope first.',409);
        if(signature.environment!==(env.DOCUSIGN_ENV||'demo'))throw error('This envelope belongs to another DocuSign environment.',409);
        const client=await docusignClient(env);
        if(input.action==='recover') {
            if(signature.status!=='creating' || !signature.operation_id)throw error('No uncertain creation to recover.');
            const found=await client.call(`/envelopes?transaction_ids=${encodeURIComponent(signature.operation_id)}`);
            const matches=found.envelopes||[];
            if(matches.length!==1 || !matches[0].envelopeId)throw error('No unique envelope found. Inspect DocuSign before any retry; do not create another request.',409);
            await env.DB.prepare("UPDATE packet_signatures SET envelope_id = ?, status = 'created', operation_id = NULL WHERE packet_id = ? AND packet_version = ? AND status = 'creating'").bind(matches[0].envelopeId,packetId,version).run();
            return jsonResponse({success:true});
        }
        if(!signature.envelope_id)throw error('Envelope creation needs recovery.',409);
        if(signature.operation_id)throw error('A signing operation is already running. Review its outcome before retrying.',409);
        if(input.action==='sync' && signature.last_checked_at && Date.now()-Date.parse(signature.last_checked_at)<15*60*1000)throw error('Status was checked recently. Check again after 15 minutes.',429);
        if(input.action==='send' && (state.status!=='approved' || !['created','send_uncertain'].includes(signature.status)))throw error('Envelope is not ready to send.',409);
        if(input.action==='send' && input.previewConfirmed!==true)throw error('Preview this envelope in DocuSign and confirm every signature tab is correctly positioned.');
        lock=crypto.randomUUID();
        const locked=await env.DB.prepare('UPDATE packet_signatures SET operation_id = ? WHERE packet_id = ? AND packet_version = ? AND operation_id IS NULL').bind(lock,packetId,version).run();
        if(!locked.meta?.changes)throw error('A signing operation is already running.',409);
        const path=`/envelopes/${encodeURIComponent(signature.envelope_id)}`;
        let remote=await client.call(path);
        if(input.action==='void') {
            if(remote.status==='completed')throw error('Completed envelopes cannot be voided. Keep the signed version; a corrected case requires administrator review.',409);
            if(remote.status!=='voided')await client.call(path,'PUT',{status:'voided',voidedReason:'Owner requested corrections before mailing.'});
            await env.DB.prepare("UPDATE packet_signatures SET status = 'voided' WHERE packet_id = ? AND packet_version = ? AND operation_id = ?").bind(packetId,version,lock).run();
            return jsonResponse({success:true});
        }
        if(input.action==='send' && remote.status==='created') {
            // Mark uncertainty before the external send. A retry reads remote state first.
            await env.DB.prepare("UPDATE packet_signatures SET status = 'send_uncertain' WHERE packet_id = ? AND packet_version = ? AND operation_id = ?").bind(packetId,version,lock).run();
            if(!await paidFulfillment(env.DB,packetId,version,appeal.customer_id))throw error('Fulfillment payment is no longer valid.',402);
            await client.call(path,'PUT',{status:'sent'});remote={...remote,status:'sent'};
        }
        const next=structuredClone(state);next.envelopeId=signature.envelope_id;next.signatureAcceptance='assumed_unverified';next.signatureEnvironment=signature.environment;
        if(['sent','delivered','signed'].includes(remote.status))next.status='awaiting_signature';
        if(remote.status==='completed') {
            const recipients=await client.call(`${path}/recipients`);
            const signers=recipients.signers||[];
            if(signers.length!==1 || signers[0].status!=='completed' || signers[0].email?.toLowerCase()!==appeal.customer_email.toLowerCase())throw error('Completed signer does not match the packet owner.',409);
            if(state.documents.length>48)throw error('Document limit reached.');
            if(!state.signedId || !state.certificateId) {
                for(const [remoteId,kind,field] of [['combined','signed_packet','signedId'],['certificate','certificate','certificateId']]) {
                    const bytes=await client.call(`${path}/documents/${remoteId}`, 'GET',undefined,true);
                    const id=crypto.randomUUID(),key=`packets/${packetId}/${signature.envelope_id}/${kind}.pdf`;
                    await env.APPEAL_PACKETS.put(key,bytes,{httpMetadata:{contentType:'application/pdf'}});
                    next.documents.push({id,key,kind,version,name:`${kind}-v${version}.pdf`,type:'application/pdf',size:bytes.length,uploadedAt:new Date().toISOString()});next[field]=id;
                }
            }
            next.status='signed';next.signedAt=remote.completedDateTime||new Date().toISOString();
        }
        const event=crypto.randomUUID(),checked=new Date().toISOString();
        const result=await env.DB.batch([
            env.DB.prepare('UPDATE appeal_packets SET state_json = ?, revision = revision + 1, last_event_id = ?, updated_at = CURRENT_TIMESTAMP WHERE transaction_id = ? AND revision = ?').bind(JSON.stringify(next),event,packetId,row.revision),
            env.DB.prepare('INSERT INTO appeal_packet_events (id, transaction_id, actor_id, action, status) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM appeal_packets WHERE transaction_id = ? AND last_event_id = ?)').bind(event,packetId,user.uid,`docusign_${input.action}`,next.status,packetId,event),
            env.DB.prepare('UPDATE packet_signatures SET status = ?, last_checked_at = ?, updated_at = CURRENT_TIMESTAMP WHERE packet_id = ? AND packet_version = ? AND operation_id = ?').bind(remote.status,checked,packetId,version,lock)
        ]);
        if(!result[0].meta?.changes)throw error('Packet changed. Refresh and synchronize the existing envelope.',409);
        return jsonResponse({success:true,status:remote.status,message:remote.status==='completed'?'Signed packet and completion certificate retrieved.':'DocuSign status updated.'});
    } catch(e) {
        console.error('DocuSign operation failed:',e.message);
        return jsonResponse({error:e.status?e.message:'Signing is unavailable. Check credentials, storage and database configuration.'},e.status||503);
    } finally {
        if(lock)await env.DB.prepare('UPDATE packet_signatures SET operation_id = NULL WHERE packet_id = ? AND packet_version = ? AND operation_id = ?').bind(packetId,version,lock).run().catch(()=>{});
    }
}
