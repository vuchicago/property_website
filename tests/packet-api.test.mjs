import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/packet.js';
import { onRequestGet as checkoutStatus } from '../functions/api/session-status.js';
import { onRequestPost as checkout } from '../functions/api/create-checkout-session.js';
import { recordPaidAppeal } from '../functions/api/_appeals.js';

const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign','verify']);
const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey); jwk.kid = 'test';
let stripeCalls = 0;
let checkoutBody;
globalThis.fetch = async (url, options) => {
    if (String(url).includes('googleapis.com')) return Response.json({ keys: [jwk] });
    stripeCalls++;
    if (options?.method === 'POST') {
        checkoutBody = new URLSearchParams(options.body);
        return Response.json({id:'cs_test',url:'https://checkout.stripe.com/test',payment_status:'unpaid'});
    }
    return Response.json({ id: 'cs_test', client_reference_id: 'owner', status: 'complete', payment_status: 'unpaid', metadata: {} });
};
async function token(uid) {
    const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const content = `${enc({alg:'RS256',kid:'test'})}.${enc({sub:uid,email:`${uid}@example.com`,email_verified:true,aud:'cookcounty-tax-compare',iss:'https://securetoken.google.com/cookcounty-tax-compare',exp:Math.floor(Date.now()/1000)+3600})}`;
    return `${content}.${Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(content))).toString('base64url')}`;
}
async function request(uid, input = null, suffix = '') {
    return new Request(`https://example.com/api/packet?id=cs_test${suffix}`, { method:input ? 'POST' : 'GET', headers:{Authorization:`Bearer ${await token(uid)}`, 'Content-Type':'application/json'}, ...(input ? {body:JSON.stringify(input)} : {}) });
}
function env({ paid = true, state = null, conflict = false } = {}) {
    const appeal = { transaction_id:'cs_test',customer_id:'owner',customer_email:'owner@example.com',property_address:'123 Test',payment_status:paid?'paid':'refunded' };
    return { DB: { prepare(sql) { let args; return { bind(...values) {args=values;return this;}, async first() {
        if(sql.includes('FROM appeals ')) return appeal;
        if(sql.includes('FROM admins ')) return args[0] === 'admin@example.com' ? {role:'admin'} : null;
        if(sql.includes('FROM appeal_packets ')) return state ? {revision:1,state_json:JSON.stringify(state)} : null;
        return null;
    }, async all(){return {results:[]};} }; }, async batch(){return [{},{meta:{changes:conflict?0:1}},{}];} }, APPEAL_PACKETS: { async get(){return {body:'%PDF-test'};} } };
}
test('API rejects anonymous requests', async () => {
    assert.equal((await onRequest({request:new Request('https://example.com/api/packet?id=cs_test'),env:env()})).status,401);
});
test('unrelated customer cannot read case or download document', async () => {
    for(const suffix of ['', '&document=secret']) assert.equal((await onRequest({request:await request('stranger',null,suffix),env:env()})).status,404);
});
test('owner can read; refunded order cannot mutate', async () => {
    assert.equal((await onRequest({request:await request('owner'),env:env()})).status,200);
    assert.equal((await onRequest({request:await request('owner',{action:'intake',revision:0}),env:env({paid:false})})).status,402);
});
test('client cannot inject a private object reference', async () => {
    const result=await onRequest({request:await request('admin',{action:'packet',revision:0,document:{id:'bad',key:'someone-elses-file'}}),env:env()});
    assert.equal(result.status,400);
});
test('revision conflicts fail before modifying the case', async () => {
    const result=await onRequest({request:await request('owner',{action:'intake',revision:3}),env:env()});
    assert.equal(result.status,409);
});
test('signed PDF is available only through authorized download and is not cacheable', async () => {
    const state={status:'signed',version:1,documents:[{id:'doc',key:'private/key',name:'signed.pdf',type:'application/pdf'}]};
    const response=await onRequest({request:await request('owner',null,'&document=doc'),env:env({state})});
    assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);
    assert.match(response.headers.get('Content-Disposition'),/attachment/);
    const result=await onRequest({request:await request('owner'),env:env({state})});
    assert.equal((await result.json()).state.documents[0].key,undefined);
});
test('checkout requires configured private storage before charging', async () => {
    const before=stripeCalls;
    const result=await checkout({request:await request('owner',{}),env:{DEPLOYMENT_READY:'1'}});
    assert.equal(result.status,503);assert.equal(stripeCalls,before);
});
test('checkout status requires ownership; complete but unpaid never records payment', async () => {
    const context = async uid => ({request:new Request('https://example.com/api/session-status?session_id=cs_test',{headers:{Authorization:`Bearer ${await token(uid)}`}}),env:{STRIPE_MODE:'test',STRIPE_TEST_SECRET_KEY:'sk_test_fixture',DB:{prepare(){throw new Error('Must not write unpaid order');}}}});
    assert.equal((await checkoutStatus(await context('stranger'))).status,404);
    const result=await checkoutStatus(await context('owner'));
    assert.equal(result.status,200);assert.equal((await result.json()).payment_status,'unpaid');
});
test('checkout charges exactly $49 and records service consent metadata', async () => {
    const environment = {DEPLOYMENT_READY:'1',APPEAL_PACKETS:{async head(){return null;}},DOCUSIGN_INTEGRATION_KEY:'fixture',DOCUSIGN_USER_ID:'fixture',DOCUSIGN_ACCOUNT_ID:'fixture',DOCUSIGN_PRIVATE_KEY:'fixture',STRIPE_MODE:'test',STRIPE_TEST_SECRET_KEY:'sk_test_fixture',STRIPE_TEST_WEBHOOK_SECRET:'whsec_fixture',APPEAL_HELP_AMOUNT_CENTS:9900,DB:{prepare(sql){return {bind(){return this;},async first(){
        if(sql.includes('FROM appeals WHERE'))return {customer_id:'owner',property_address:'123 Test',property_key:'test-key'};
        if(sql.includes('FROM appeal_packets'))return {revision:2,state_json:JSON.stringify({status:'approved',version:1,approval:{version:1},intake:{agency:'assessor',ownerName:'Test Owner'}})};
        return null;
    },async run(){return {meta:{changes:1}};}};}}};
    const result=await checkout({request:await request('owner',{packetId:'free_test',fulfillmentAccepted:true}),env:environment});
    assert.equal(result.status,200);
    assert.equal(checkoutBody.get('line_items[0][price_data][unit_amount]'),'4900');
    assert.equal(checkoutBody.get('metadata[serviceType]'),'assessor_print_mail');
    assert.equal(checkoutBody.get('metadata[serviceTermsVersion]'),'2026-11-03-fulfillment');
});
test('return-page refresh cannot restore refunded orders to paid or re-notify admins', async () => {
    let insertSql;
    const environment={DB:{prepare(sql){return {bind(){return this;},async first(){return {payment_status:'refunded'};},async run(){insertSql=sql;return {};}};}}};
    const result=await recordPaidAppeal(environment,{transactionId:'cs_test',paymentStatus:'paid'});
    assert.match(insertSql,/CASE WHEN appeals.payment_status = 'refunded' THEN 'refunded'/);
    assert.equal(result.emailStatus,'not_sent_existing_payment');
});

test('free preparation remains editable without payment, while signing and mailing are gated',async()=>{
    const environment=env();const original=environment.DB.prepare;
    environment.DB.prepare=sql=>{if(sql.includes('FROM appeals '))return {bind(){return this;},async first(){return {transaction_id:'free_test',customer_id:'owner',payment_status:'free'};}};return original(sql);};
    const req=async input=>new Request('https://example.com/api/packet?id=free_test',{method:'POST',headers:{Authorization:`Bearer ${await token('owner')}`,'Content-Type':'application/json'},body:JSON.stringify(input)});
    const intake={action:'intake',revision:0,agency:'assessor',taxYear:2026,ownerName:'Owner',mailingAddress:'123 Test',reason:'uniformity',explanation:'My facts',individualOwner:true,noExistingAppeal:true};
    assert.equal((await onRequest({request:await req(intake),env:environment})).status,200);
    assert.equal((await onRequest({request:await req({action:'request_signature',revision:0}),env:environment})).status,400);
    assert.equal((await onRequest({request:await req({action:'mail',revision:0}),env:environment})).status,402);
});
