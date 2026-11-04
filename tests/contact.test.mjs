import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/contact.js';

const entry = { name: 'Test Owner', email: 'OWNER@EXAMPLE.COM', propertyAddress: '123 Test Ave, Skokie, IL', inquiryType: 'property-tax-waitlist' };

function fixture(data = entry, { configured = true, deliveryError = false, databaseError = false } = {}) {
    const writes = [], messages = [];
    return {
        writes, messages,
        request: new Request('https://example.test/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
        env: {
            DB: { prepare(sql) { return { bind(...args) { this.args = args; return this; }, async run() {
                if (databaseError) throw new Error('Database unavailable');
                writes.push({ sql, args: this.args });
                return { meta: { last_row_id: 7, changes: 1 } };
            } }; } },
            ...(configured ? { EMAIL: { async send(message) { messages.push(message); if (deliveryError) throw new Error('Test delivery failure'); } } } : {})
        }
    };
}

test('anonymous waitlist accepts a typed address with no phone or suggestion ID', async () => {
    const context = fixture({ ...entry, propertyAddress: `  ${entry.propertyAddress}  ` });
    const response = await onRequestPost(context);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, emailSent: true, captured: true });
    assert.deepEqual(context.writes[0].args.slice(0, 5), ['Property Tax Appeal Waitlist', 'Test Owner', 'owner@example.com', '', entry.propertyAddress]);
    assert.equal(context.messages[0].to, 'vu@cookcountytaxcompare.com');
    assert.equal(context.messages[0].replyTo, 'owner@example.com');
});

test('waitlist stays captured when outbound email is unconfigured or fails', async () => {
    for (const options of [{ configured: false }, { deliveryError: true }]) {
        const context = fixture(entry, options);
        const response = await onRequestPost(context);
        assert.equal(response.status, 200);
        assert.equal((await response.json()).captured, true);
        assert.deepEqual(context.writes[1].args.slice(0, 1), [0]);
        assert.equal(context.writes[1].args[2], 7);
    }
});

test('waitlist rejects missing or invalid email, phone, and property before saving', async () => {
    for (const update of [{ email: '' }, { email: 'invalid' }, { phone: '123' }, { propertyAddress: '' }, { propertyAddress: '   ' }]) {
        const context = fixture({ ...entry, ...update });
        assert.equal((await onRequestPost(context)).status, 400, JSON.stringify(update));
        assert.equal(context.writes.length, 0);
        assert.equal(context.messages.length, 0);
    }
});

test('insurance still requires a valid phone when waitlist phone is optional', async () => {
    const context = fixture({ ...entry, inquiryType: 'insurance' });
    assert.equal((await onRequestPost(context)).status, 400);
    assert.equal(context.writes.length, 0);
});

test('all inquiry types send submitted details to the shared inbox and escape HTML', async () => {
    for (const inquiryType of ['property-tax-waitlist', 'insurance', 'partnership']) {
        const context = fixture({ ...entry, inquiryType, name: '<b>Owner</b>', phone: '(773) 555-1234', firmName: 'Test Firm', message: 'Line one\n<script>test</script>' });
        assert.equal((await onRequestPost(context)).status, 200);
        const message = context.messages[0];
        assert.deepEqual(message.to, inquiryType==='insurance'?['vu@cookcountytaxcompare.com','vnguyen1@amfam.com']:'vu@cookcountytaxcompare.com');
        assert.ok(message.html.includes('&lt;b&gt;Owner&lt;/b&gt;'));
        assert.ok(message.html.includes('Line one<br>&lt;script&gt;test&lt;/script&gt;'));
        assert.ok(!message.html.includes('<script>'));
        for (const value of ['Test Firm', entry.propertyAddress, 'owner@example.com', '(773) 555-1234']) assert.ok(message.text.includes(value));
    }
});

test('database failure reports failure before trying email', async () => {
    const context = fixture(entry, { databaseError: true });
    assert.equal((await onRequestPost(context)).status, 500);
    assert.equal(context.messages.length, 0);
});

test('Contact and Insurance notifications include the required details and both requested recipients',async()=>{
    for(const inquiryType of ['contact','insurance']) {
        const context=fixture({...entry,inquiryType,phone:'7735551234',insuranceTypes:['Business Insurance','Home Insurance','Auto Insurance','Life Insurance']});
        assert.equal((await onRequestPost(context)).status,200);
        assert.deepEqual(context.messages[0].to,['vu@cookcountytaxcompare.com','vnguyen1@amfam.com']);
        assert.equal(context.messages[0].replyTo,'owner@example.com');
        for(const value of ['Test Owner','owner@example.com','(773) 555-1234',entry.propertyAddress])assert.ok(context.messages[0].text.includes(value),value);
        if(inquiryType==='insurance')assert.equal(context.writes[0].args[5],'Home Insurance, Auto Insurance, Life Insurance, Business Insurance');
    }
});

test('Contact and Insurance reject missing required details before saving or sending',async()=>{
    for(const inquiryType of ['contact','insurance'])for(const change of [{name:''},{email:''},{phone:''},{propertyAddress:''}]) {
        const context=fixture({...entry,inquiryType,phone:'7735551234',...change});
        assert.equal((await onRequestPost(context)).status,400);
        assert.equal(context.writes.length,0);assert.equal(context.messages.length,0);
    }
    const invalid=fixture({...entry,inquiryType:'insurance',phone:'7735551234',insuranceTypes:['Unknown Coverage']});
    assert.equal((await onRequestPost(invalid)).status,400);assert.equal(invalid.messages.length,0);
});

test('Cloudflare REST delivery sends both recipients and retains the request on a partial bounce',async()=>{
    const original=globalThis.fetch;
    try {
        for(const bounce of [false,true]) {
            const context=fixture({...entry,inquiryType:'insurance',phone:'7735551234',insuranceTypes:['Home Insurance']},{configured:false});
            context.env.CLOUDFLARE_EMAIL_API_TOKEN='local_fixture';context.env.CLOUDFLARE_ACCOUNT_ID='local_fixture';
            let outgoing;
            globalThis.fetch=async(url,options)=>{
                assert.equal(url,'https://api.cloudflare.com/client/v4/accounts/local_fixture/email/sending/send');outgoing=JSON.parse(options.body);
                return Response.json({success:true,result:{delivered:['vu@cookcountytaxcompare.com'],queued:bounce?[]:['vnguyen1@amfam.com'],permanent_bounces:bounce?['vnguyen1@amfam.com']:[]}});
            };
            const response=await onRequestPost(context);assert.equal(response.status,200);
            assert.deepEqual(outgoing.to,['vu@cookcountytaxcompare.com','vnguyen1@amfam.com']);assert.equal(outgoing.reply_to,'owner@example.com');
            const result=await response.json();assert.equal(result.captured,true);assert.equal(result.emailSent,!bounce);
            assert.equal(context.writes[1].args[0],bounce?0:1);
        }
    }finally{globalThis.fetch=original;}
});
