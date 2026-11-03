import { requireAdminAccount, jsonResponse } from './_admin.js';
import { FORM_KINDS, FORM_SOURCES, FORM_VALUES, formManifestKey, inspectOfficialForm, validateFormMapping } from '../_official_forms.js';

const MAX=4*1024*1024;
async function bounded(request) {
    const reader=request.body?.getReader();
    if(!reader)throw Object.assign(new Error('Choose an official PDF.'),{status:400});
    let size=0;const chunks=[];
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX+65536){await reader.cancel();throw Object.assign(new Error('Maximum official form size is 4 MB.'),{status:413});}chunks.push(value);}
    return new Request(request.url,{method:'POST',headers:request.headers,body:new Blob(chunks)});
}
export async function onRequest(context) {
    const {user,response}=await requireAdminAccount(context);
    if(response)return response;
    try {
        const storage=context.env.APPEAL_PACKETS;
        if(!storage)return jsonResponse({error:'Private form storage is not configured.'},503);
        const url=new URL(context.request.url),year=Number(url.searchParams.get('year'));
        const kind=url.searchParams.get('kind') || 'application';
        if(!Number.isInteger(year)||year<2020||year>new Date().getUTCFullYear()+1||!FORM_KINDS[kind])return jsonResponse({error:'Choose a supported assessment year and form.'},400);
        if(context.request.method==='GET') {
            const object=await storage.get(formManifestKey(year,kind));
            return jsonResponse({year,kind,published:object?await object.json():null,sourceUrl:FORM_SOURCES[kind],values:FORM_VALUES});
        }
        if(context.request.method!=='POST')return jsonResponse({error:'Method not allowed.'},405);
        const form=await (await bounded(context.request)).formData();
        const data=JSON.parse(String(form.get('data')||'{}')),file=form.get('file');
        if(!file || typeof file.arrayBuffer!=='function'||file.size<5||file.size>MAX)return jsonResponse({error:'Choose an official PDF of at most 4 MB.'},400);
        const bytes=new Uint8Array(await file.arrayBuffer());
        if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')return jsonResponse({error:'Choose a readable official PDF.'},400);
        if(data.action==='inspect')return jsonResponse({...await inspectOfficialForm(bytes),values:FORM_VALUES});
        if(data.action!=='publish')return jsonResponse({error:'Choose inspect or publish.'},400);
        if(data.officialReviewed!==true || data.mappingReviewed!==true || data.signaturesBlank!==true)return jsonResponse({error:'Review the current official form, every field mapping, and the blank signature blocks before publishing.'},400);
        await validateFormMapping(bytes,kind,data.mapping);
        const source=new URL(data.sourceUrl || FORM_SOURCES[kind]);
        if(source.protocol!=='https:' || !['www.cookcountyassessoril.gov','www.cookcountyassessor.com','rpie.cookcountyassessor.com','prodassets.cookcountyassessoril.gov','prodassets.cookcountyassessor.com'].includes(source.hostname))return jsonResponse({error:'Use the official Assessor source URL.'},400);
        const settings=new TextEncoder().encode(JSON.stringify({year,kind,mapping:data.mapping}));
        const digestBytes=new Uint8Array(bytes.length+settings.length);digestBytes.set(bytes);digestBytes.set(settings,bytes.length);
        const hash=await crypto.subtle.digest('SHA-256',digestBytes);
        const revision=Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
        const key=`official-forms/assessor/${year}/${kind}/${revision}.pdf`;
        const manifest={year,kind,key,revision,mapping:data.mapping,sourceUrl:source.href,reviewedBy:user.email,reviewedAt:new Date().toISOString()};
        await storage.put(key,bytes,{httpMetadata:{contentType:'application/pdf'}});
        await storage.put(formManifestKey(year,kind),JSON.stringify(manifest),{httpMetadata:{contentType:'application/json'}});
        return jsonResponse({success:true,year,kind,revision});
    } catch(error) {
        console.error('Official form setup failed:',error.message);
        return jsonResponse({error:error.status?error.message:'Could not inspect or publish the official form. Use a readable, unlocked PDF and valid field mapping.'},error.status || 400);
    }
}
