import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/self-appeal.js';
import {checklist,DEFAULT_PROFILE} from '../self-appeal-checklist.js';
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='self-test';
globalThis.fetch=async url=>{assert.ok(String(url).includes('googleapis.com'),'No payment or county request');return Response.json({keys:[jwk]});};
async function request(input=null,{email='vuchicago@gmail.com',uid='pilot',property=1,suffix='',file=null}={}){
    const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
    const contents=`${encode({alg:'RS256',kid:'self-test'})}.${encode({sub:uid,email,email_verified:true,aud:'cookcounty-tax-compare',iss:'https://securetoken.google.com/cookcounty-tax-compare',exp:Math.floor(Date.now()/1000)+3600})}`;
    const token=`${contents}.${Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(contents))).toString('base64url')}`;
    const headers={Authorization:`Bearer ${token}`};let body;
    if(file){body=new FormData();body.set('data',JSON.stringify(input));body.set('file',file,'evidence.pdf');}else if(input){headers['Content-Type']='application/json';body=JSON.stringify(input);}
    return new Request(`https://example.com/api/self-appeal?property=${property}&agency=assessor&year=2026${suffix}`,{headers,method:input?'POST':'GET',body});
}
function environment(){
    const rows=new Map(),objects=new Map();
    return {rows,objects,APPEAL_PACKETS:{async put(k,v){objects.set(k,v);},async get(k){return objects.has(k)?{body:objects.get(k)}:null;},async delete(k){objects.delete(k);}},DB:{prepare(sql){return {sql,args:[],bind(...args){this.args=args;return this;},async first(){if(sql.includes('FROM user_addresses'))return this.args[0]===1&&this.args[1]==='pilot'?{id:1,address:'123 Test',property_key:'test'}:null;if(sql.includes('FROM self_appeal_cases'))return rows.get(JSON.stringify(this.args))||null;return null;}};},async batch(statements){const [insert,update]=statements;const key=JSON.stringify(insert.args.slice(0,4));if(!rows.has(key))rows.set(key,{state_json:insert.args[4],revision:0});const row=rows.get(key);if(row.revision!==update.args.at(-1))return [{},{meta:{changes:0}}];row.state_json=update.args[0];row.revision++;return [{},{meta:{changes:1}}];}}};
}
const save={action:'save',revision:0,ownerConfirmed:true,profile:{...DEFAULT_PROFILE},checks:{property:true,deadline:true},notes:'Requested value and supporting facts'};
test('conditional checklists distinguish agencies and avoid universal notarization claims',()=>{
    const own=checklist('assessor',DEFAULT_PROFILE);assert.equal(own.find(x=>x.id==='photo').required,false);
    const board=checklist('board_of_review',DEFAULT_PROFILE);assert.equal(board.find(x=>x.id==='photo').required,true);
    assert.equal(own.some(x=>x.id==='sale'),false);
    const conditional=checklist('assessor',{...DEFAULT_PROFILE,recentSale:true,saleDifference:true,rental:true,condo:true,appraisal:true});
    for(const id of ['sale','affidavit','rental','condo','appraisal'])assert.ok(conditional.some(x=>x.id===id));
    assert.match(own.find(x=>x.id==='complaint').notarization,/current form/);
});
test('anonymous and non-pilot users are rejected',async()=>{
    assert.equal((await onRequest({request:new Request('https://example.com/api/self-appeal'),env:environment()})).status,401);
    assert.equal((await onRequest({request:await request(null,{email:'other@example.com'}),env:environment()})).status,403);
});
test('pilot cannot access another user’s saved property or documents',async()=>{
    assert.equal((await onRequest({request:await request(null,{property:2}),env:environment()})).status,404);
    assert.equal((await onRequest({request:await request(null,{uid:'other',suffix:'&document=secret'}),env:environment()})).status,404);
});
test('personal progress saves without payment or R2; reload and stale-write checks',async()=>{
    const env=environment();delete env.APPEAL_PACKETS;
    assert.equal((await onRequest({request:await request(save),env})).status,200);
    const loaded=await (await onRequest({request:await request(),env})).json();
    assert.equal(loaded.state.notes,save.notes);assert.equal(loaded.state.checks.property,true);assert.equal(loaded.revision,1);
    assert.equal((await onRequest({request:await request(save),env})).status,409);
});
test('changed circumstances clear completion checks',async()=>{
    const env=environment();await onRequest({request:await request(save),env});
    await onRequest({request:await request({...save,revision:1,profile:{...DEFAULT_PROFILE,recentSale:true}}),env});
    const loaded=await (await onRequest({request:await request(),env})).json();assert.deepEqual(loaded.state.checks,{});assert.equal(loaded.state.profile.recentSale,true);
});
test('private upload, protected download and filing receipt association',async()=>{
    const env=environment();await onRequest({request:await request(save),env});
    assert.equal((await onRequest({request:await request({action:'upload',revision:1,item:'receipt'},{file:new Blob(['%PDF-1.7 test'])}),env})).status,200);
    const data=await (await onRequest({request:await request(),env})).json();const doc=data.state.documents[0];assert.equal(doc.key,undefined);
    const download=await onRequest({request:await request(null,{suffix:`&document=${doc.id}`}),env});assert.equal(download.status,200);assert.match(download.headers.get('Cache-Control'),/no-store/);
    assert.equal((await onRequest({request:await request({action:'record_filing',revision:2,docket:'123',filedOn:'2026-11-02',receiptId:'wrong'}),env})).status,400);
    assert.equal((await onRequest({request:await request({action:'record_filing',revision:2,docket:'123',filedOn:'2026-11-02',receiptId:doc.id}),env})).status,200);
    const final=await (await onRequest({request:await request(),env})).json();assert.equal(final.state.filing.verification,'owner-recorded');
});
