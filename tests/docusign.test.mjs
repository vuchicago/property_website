import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost} from '../functions/api/packet-signature.js';
import {signatureTabs} from '../functions/api/_docusign.js';
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='ds-test';
const privateKey=Buffer.from(await crypto.subtle.exportKey('pkcs8',pair.privateKey)).toString('base64');
let remote='created',remoteEmail='owner@example.com',creates=0,sends=0,downloads=0,providerCalls=0,createdBody;
globalThis.fetch=async (url,options={})=>{
    const u=String(url);
    if(u.includes('googleapis.com'))return Response.json({keys:[jwk]});
    providerCalls++;
    if(u.endsWith('/oauth/token')) {
        const assertion=new URLSearchParams(options.body).get('assertion');const [h,p,s]=assertion.split('.');
        assert.equal(JSON.parse(Buffer.from(p,'base64url')).aud,'account-d.docusign.com');
        assert.ok(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',pair.publicKey,Buffer.from(s,'base64url'),Buffer.from(`${h}.${p}`)));
        return Response.json({access_token:'secret-test-token'});
    }
    assert.equal(options.headers.Authorization,'Bearer secret-test-token');
    if(u.endsWith('/oauth/userinfo'))return Response.json({accounts:[{account_id:'account',base_uri:'https://demo.docusign.net'}]});
    if(u.endsWith('/envelopes')&&options.method==='POST'){creates++;createdBody=JSON.parse(options.body);return Response.json({envelopeId:'env-123',status:'created'});}
    if(u.endsWith('/recipients'))return Response.json({signers:[{email:remoteEmail,status:'completed'}]});
    if(u.includes('/documents/')){downloads++;return new Response('%PDF-1.7 provider-signed');}
    if(options.method==='PUT'){const body=JSON.parse(options.body);remote=body.status;if(remote==='sent')sends++;return Response.json({status:remote});}
    return Response.json({envelopeId:'env-123',status:remote,completedDateTime:'2026-11-03T12:00:00Z'});
};
async function request(uid,input){
    const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
    const content=`${encode({alg:'RS256',kid:'ds-test'})}.${encode({sub:uid,email:`${uid}@example.com`,email_verified:true,aud:'cookcounty-tax-compare',iss:'https://securetoken.google.com/cookcounty-tax-compare',exp:Math.floor(Date.now()/1000)+3600})}`;
    const sig=Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,Buffer.from(content))).toString('base64url');
    return new Request('https://example.com/api/packet-signature',{method:'POST',headers:{Authorization:`Bearer ${content}.${sig}`,'Content-Type':'application/json'},body:JSON.stringify({packetId:'free_test',revision:0,...input})});
}
function env(){
    const e={DOCUSIGN_ENV:'demo',DOCUSIGN_INTEGRATION_KEY:'app',DOCUSIGN_USER_ID:'user',DOCUSIGN_ACCOUNT_ID:'account',DOCUSIGN_PRIVATE_KEY:`-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`,paid:true,signature:null,revision:0,
    state:{status:'approved',version:1,approval:{version:1},packetId:'pdf',documents:[{id:'pdf',kind:'packet',version:1,key:'original'}],intake:{agency:'assessor',ownerName:'Test Owner'}},objects:new Map([['original','%PDF-1.7 original']])};
    e.APPEAL_PACKETS={async get(k){return e.objects.has(k)?{body:e.objects.get(k)}:null;},async put(k,v){e.objects.set(k,v);}};
    e.DB={prepare(sql){let args=[];return {bind(...v){args=v;return this;},async first(){
        if(sql.includes('FROM admins'))return args[0]==='admin@example.com'?{role:'admin'}:null;
        if(sql.includes('FROM appeals WHERE'))return {customer_id:'owner',customer_email:'owner@example.com'};
        if(sql.includes('JOIN appeals'))return e.paid?{transaction_id:'cs_paid'}:null;
        if(sql.includes('FROM appeal_packets'))return {revision:e.revision,state_json:JSON.stringify(e.state)};
        if(sql.includes('FROM packet_signatures'))return e.signature;
        throw new Error(sql);
    },async run(){
        if(sql.startsWith('INSERT OR IGNORE INTO packet_signatures')){if(e.signature)return {meta:{changes:0}};e.signature={environment:args[2],operation_id:args[3],status:'creating'};}
        else if(sql.includes("SET envelope_id = ?")){e.signature.envelope_id=args[0];e.signature.status='created';e.signature.operation_id=null;}
        else if(sql.includes('SET operation_id = ?')){if(e.signature.operation_id)return {meta:{changes:0}};e.signature.operation_id=args[0];}
        else if(sql.includes('SET operation_id = NULL'))e.signature.operation_id=null;
        else if(sql.includes("SET status = 'send_uncertain'"))e.signature.status='send_uncertain';
        else if(sql.includes("SET status = 'voided'"))e.signature.status='voided';
        else throw new Error(sql);
        return {meta:{changes:1}};
    },sql,get args(){return args;}};},async batch(stmts){e.state=JSON.parse(stmts[0].args[0]);e.revision++;e.signature.status=stmts[2].args[0];e.signature.last_checked_at=stmts[2].args[1];return [{meta:{changes:1}},{},{}];}};
    return e;
}
const create={action:'create',positions:[{page:1,x:120,y:500}],placementReviewed:true,noNotaryRequired:true};
test('signature positions reject invalid coordinates and missing fields',()=>{
    assert.throws(()=>signatureTabs([]));assert.throws(()=>signatureTabs([{page:0,x:10,y:10}]));
    assert.equal(signatureTabs(create.positions)[0].documentId,'1');
});
test('signing requires administrator, paid fulfillment and matching revision',async()=>{
    const e=env();const before=creates, beforeCalls=providerCalls;
    assert.equal((await onRequestPost({request:await request('stranger',create),env:e})).status,404);
    assert.equal((await onRequestPost({request:await request('owner',create),env:e})).status,403);
    e.paid=false;assert.equal((await onRequestPost({request:await request('admin',create),env:e})).status,402);
    e.paid=true;assert.equal((await onRequestPost({request:await request('admin',{...create,revision:2}),env:e})).status,409);
    assert.equal(creates,before);assert.equal(providerCalls,beforeCalls);
});
test('draft, explicit send, owner sync and private completed artifacts',async()=>{
    const e=env();remote='created';remoteEmail='owner@example.com';const before=creates;
    const result=await onRequestPost({request:await request('admin',create),env:e});assert.equal(result.status,200);
    assert.equal(createdBody.status,'created');assert.equal(createdBody.recipients.signers[0].email,'owner@example.com');assert.equal(sends,0);
    assert.equal((await onRequestPost({request:await request('admin',create),env:e})).status,409);assert.equal(creates,before+1);
    assert.equal((await onRequestPost({request:await request('admin',{action:'send'}),env:e})).status,400);
    assert.equal((await onRequestPost({request:await request('admin',{action:'send',previewConfirmed:true}),env:e})).status,200);
    assert.equal(e.state.status,'awaiting_signature');assert.equal(sends,1);
    assert.equal((await onRequestPost({request:await request('owner',{action:'sync',revision:1}),env:e})).status,429);
    e.signature.last_checked_at=null;remote='completed';
    const completed=await onRequestPost({request:await request('owner',{action:'sync',revision:1}),env:e});assert.equal(completed.status,200);
    assert.equal(e.state.status,'signed');assert.ok(e.state.signedId);assert.ok(e.state.certificateId);assert.equal(downloads,2);
    assert.equal(e.state.signatureEnvironment,'demo');assert.equal(e.state.signatureAcceptance,'assumed_unverified');
    assert.ok(!(await completed.text()).includes('secret-test-token'));
    e.signature.last_checked_at=null;e.state.status='mailed';
    assert.equal((await onRequestPost({request:await request('owner',{action:'sync',revision:2}),env:e})).status,409);
});
test('wrong completed signer cannot mark packet signed',async()=>{
    const e=env();remote='completed';remoteEmail='wrong@example.com';e.signature={envelope_id:'env-123',environment:'demo',status:'sent'};
    assert.equal((await onRequestPost({request:await request('owner',{action:'sync'}),env:e})).status,409);
    assert.equal(e.state.status,'approved');remoteEmail='owner@example.com';
});

test('refund or unpaid fulfillment blocks sending an existing draft before provider calls',async()=>{
    const e=env();e.paid=false;e.signature={envelope_id:'env-123',environment:'demo',status:'created'};
    const before=providerCalls;
    const result=await onRequestPost({request:await request('admin',{action:'send',previewConfirmed:true}),env:e});
    assert.equal(result.status,402);assert.equal(providerCalls,before);
});
