import { requireFirebaseUser } from './_auth.js';
import { CHECKED_ON, DEFAULT_PROFILE, checklist, cleanProfile } from '../../self-appeal-checklist.js';
import { appealAccess } from './_appeal_access.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function onRequest(context) {
    let uploadedKey, committed = false;
    try {
        if (!['GET','POST'].includes(context.request.method)) return json({error:'Method not allowed'},405);
        const {user,response} = await requireFirebaseUser(context.request);
        if (response) return response;
        if (!context.env.DB) return json({error:'Database is not configured.'},503);
        if (!(await appealAccess(context.env.DB,user)).allowed) return json({error:'Self-appeal testing is currently by invitation.'},403);
        const url = new URL(context.request.url);
        const addressId = Number(url.searchParams.get('property'));
        const agency = url.searchParams.get('agency') || 'assessor';
        const year = Number(url.searchParams.get('year'));
        if (!Number.isInteger(addressId) || addressId < 1 || !['assessor','board_of_review'].includes(agency) || !Number.isInteger(year) || year < 2020 || year > new Date().getUTCFullYear()+1) return json({error:'Select a saved property, agency and tax year.'},400);
        const db = context.env.DB, key = [user.uid,addressId,agency,year];
        const property = await db.prepare('SELECT id, address, property_key FROM user_addresses WHERE id = ? AND customer_id = ?').bind(addressId,user.uid).first();
        if (!property) return json({error:'Saved property not found in your account.'},404);
        const row = await db.prepare('SELECT state_json, revision FROM self_appeal_cases WHERE customer_id = ? AND address_id = ? AND agency = ? AND tax_year = ?').bind(...key).first();
        const state = row ? JSON.parse(row.state_json) : {profile:{...DEFAULT_PROFILE},checks:{},notes:'',documents:[],filing:null,ownerConfirmed:false};
        const revision = row?.revision || 0;
        if (context.request.method === 'GET') {
            const id = url.searchParams.get('document');
            if (id) {
                const doc = state.documents.find(d => d.id === id);
                if (!doc) return json({error:'Document not found.'},404);
                const object = await context.env.APPEAL_PACKETS?.get(doc.key);
                if (!object) return json({error:'Document unavailable.'},404);
                return new Response(object.body,{headers:{'Content-Type':doc.type,'Content-Disposition':`attachment; filename="${doc.name}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
            }
            return json({property,state:{...state,documents:state.documents.map(({key,...doc})=>doc)},revision,checkedOn:CHECKED_ON,storageReady:Boolean(context.env.APPEAL_PACKETS)});
        }
        // Bound chunked and Content-Length uploads before parsing; 5 MB per file.
        const reader = context.request.body?.getReader();
        if (!reader) return json({error:'Request body required.'},400);
        const chunks=[]; let size=0;
        while(true) {const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5*1024*1024+65536){await reader.cancel();return json({error:'Upload limit is 5 MB.'},413);}chunks.push(value);}
        const body = new Request(context.request.url,{method:'POST',headers:context.request.headers,body:new Blob(chunks)});
        let input,file;
        if((body.headers.get('content-type')||'').startsWith('multipart/form-data')){const form=await body.formData();input=JSON.parse(form.get('data'));file=form.get('file');}else input=await body.json();
        if(!input || input.revision!==revision)return json({error:'This case changed. Reload before saving.'},409);
        const next=structuredClone(state);
        if(input.action==='save') {
            if(input.ownerConfirmed!==true)return json({error:'Confirm that this is your own individually titled residential property and review existing filings.'},400);
            let profile;try{profile=cleanProfile(input.profile);}catch(e){return json({error:e.message},400);}
            if(typeof input.notes!=='string'||input.notes.length>15000)return json({error:'Notes must be under 15,000 characters.'},400);
            const changed=JSON.stringify(profile)!==JSON.stringify(state.profile);
            next.profile=profile;next.notes=input.notes;next.ownerConfirmed=true;
            const allowed=new Set(checklist(agency,profile).map(item=>item.id));
            next.checks=changed?{}:Object.fromEntries(Object.entries(input.checks||{}).filter(([id,value])=>allowed.has(id)&&value===true));
            // Recorded county receipts remain historical even when preparation changes.
        } else if(input.action==='upload') {
            if(!context.env.APPEAL_PACKETS)return json({error:'Private storage is not configured. You can still save your checklist.'},503);
            if(state.documents.length>=50)return json({error:'Maximum 50 documents per case.'},400);
            if(!file || typeof file.arrayBuffer!=='function'||!file.size||file.size>5*1024*1024)return json({error:'Choose a PDF, JPG or PNG under 5 MB.'},400);
            if(![...checklist(agency,state.profile).map(x=>x.id),'receipt','decision'].includes(input.item))return json({error:'Select a checklist document category.'},400);
            const bytes=new Uint8Array(await file.arrayBuffer());
            const type=new TextDecoder().decode(bytes.slice(0,5))==='%PDF-'?'application/pdf':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':null;
            if(!type)return json({error:'Only PDF, JPG and PNG documents are accepted.'},400);
            const id=crypto.randomUUID();uploadedKey=`self-appeals/${user.uid}/${addressId}/${agency}/${year}/${id}`;
            await context.env.APPEAL_PACKETS.put(uploadedKey,bytes,{httpMetadata:{contentType:type}});
            next.documents.push({id,key:uploadedKey,name:String(file.name).replace(/[^\w.() -]/g,'_').slice(0,160),type,item:input.item,uploadedAt:new Date().toISOString()});
        } else if(input.action==='record_filing') {
            if(!state.ownerConfirmed)return json({error:'Save your ownership confirmation first.'},400);
            if(typeof input.docket!=='string'||!input.docket.trim()||input.docket.length>200||!state.documents.some(d=>d.id===input.receiptId&&d.item==='receipt'))return json({error:'Enter the county reference and upload/select its official receipt first.'},400);
            if(!/^\d{4}-\d{2}-\d{2}$/.test(input.filedOn||'')||!Number.isFinite(Date.parse(input.filedOn))||new Date(input.filedOn).toISOString().slice(0,10)!==input.filedOn)return json({error:'Enter a valid filing date.'},400);
            const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
            if(input.filedOn>today)return json({error:'Filing date cannot be in the future.'},400);
            next.filing={docket:input.docket.trim(),filedOn:input.filedOn,receiptId:input.receiptId,recordedAt:new Date().toISOString(),verification:'owner-recorded'};
        } else return json({error:'Unknown action.'},400);
        const result=await db.batch([
            db.prepare('INSERT OR IGNORE INTO self_appeal_cases (customer_id,address_id,agency,tax_year,state_json) VALUES (?,?,?,?,?)').bind(...key,JSON.stringify(state)),
            db.prepare('UPDATE self_appeal_cases SET state_json=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE customer_id=? AND address_id=? AND agency=? AND tax_year=? AND revision=?').bind(JSON.stringify(next),...key,revision)
        ]);
        if(!result[1].meta?.changes)return json({error:'This case changed. Reload before saving.'},409);
        committed=true;return json({success:true,requirementsChanged:input.action==='save'&&JSON.stringify(next.profile)!==JSON.stringify(state.profile)});
    } catch(error) {console.error('Self-appeal workspace:',error.message);return json({error:'Unable to load or save. Check migration 0030 and private storage configuration.'},500);}
    finally {if(uploadedKey&&!committed)await context.env.APPEAL_PACKETS.delete(uploadedKey).catch(()=>{});}
}
