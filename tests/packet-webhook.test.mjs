import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/webhook.js';

const secret = 'whsec_local_fixture';
const body = JSON.stringify({type:'ignored.test.event'});
async function signedHeader(timestamp) {
    const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const sig = Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${timestamp}.${body}`))).toString('hex');
    return `t=${timestamp},v1=${'0'.repeat(64)},v1=${sig}`;
}
function context(signature, configured = true) {
    return {request:new Request('https://example.com/api/webhook',{method:'POST',body,headers:signature?{'stripe-signature':signature}:{}}),env:{STRIPE_MODE:'test',...(configured?{STRIPE_TEST_WEBHOOK_SECRET:secret}:{})}};
}
test('webhook rejects unsigned events and missing configuration',async()=>{
    assert.equal((await onRequestPost(context(null,false))).status,503);
    assert.equal((await onRequestPost(context(null))).status,400);
});
test('webhook accepts a valid rotated signature and rejects stale replays',async()=>{
    assert.equal((await onRequestPost(context(await signedHeader(Math.floor(Date.now()/1000))))).status,200);
    assert.equal((await onRequestPost(context(await signedHeader(Math.floor(Date.now()/1000)-600)))).status,400);
});
test('webhook rejects incorrect signature',async()=>{
    assert.equal((await onRequestPost(context(`t=${Math.floor(Date.now()/1000)},v1=${'0'.repeat(64)}`))).status,400);
});
