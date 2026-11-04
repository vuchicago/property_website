// Executes the compiled Pages Worker and real local D1. No production resources.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { Miniflare } = require(process.env.MINIFLARE_MODULE || 'miniflare');
const root = path.resolve(__dirname, '..');
const bundle = process.env.APPEAL_WORKER_BUNDLE || '/tmp/cookcounty-regression-worker/index.js';
let worker, db, pair, jwk, packetId;
const stripeSessions=new Map();

before(async () => {
    assert.ok(fs.existsSync(bundle), 'Compile the Pages Functions bundle first; see TESTING.md.');
    pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
    jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    jwk.kid = 'local-worker';
    worker = new Miniflare({
        modules: true,
        modulesRoot: path.dirname(bundle),
        scriptPath: bundle,
        compatibilityDate: '2026-02-01',
        d1Databases: ['DB'],
        r2Buckets: ['APPEAL_PACKETS'],
        bindings:{APPEAL_CHECKOUT_TESTING:'true',DEPLOYMENT_READY:'0',STRIPE_MODE:'live',STRIPE_SECRET_KEY:'sk_live_local_fixture',STRIPE_WEBHOOK_SECRET:'whsec_local_fixture',DOCUSIGN_ENV:'demo'},
        outboundService: async request => {
            const url=new URL(request.url);
            if(url.hostname==='api.stripe.com') {
                if(request.method==='POST') {
                    const body=new URLSearchParams(await request.text()),id=`cs_live_local_${stripeSessions.size+1}`;
                    const metadata=Object.fromEntries([...body].filter(([key])=>key.startsWith('metadata[')).map(([key,value])=>[key.slice(9,-1),value]));
                    const session={id,url:`https://checkout.stripe.com/c/pay/${id}`,client_reference_id:body.get('client_reference_id'),metadata,payment_status:'unpaid',status:'open',amount_total:Number(body.get('line_items[0][price_data][unit_amount]')),customer_details:{email:body.get('customer_email')}};
                    stripeSessions.set(id,session);return Response.json(session);
                }
                return Response.json(stripeSessions.get(url.pathname.split('/').pop()) || {error:{message:'No fixture session'}});
            }
            assert.ok(request.url.includes('www.googleapis.com/service_accounts/v1/jwk/'), 'Unexpected external request in local Worker test');
            return Response.json({ keys: [jwk] });
        }
    });
    db = await worker.getD1Database('DB');
    // Python's SQLite parser preserves complete trigger statements, including
    // their internal semicolons, when splitting the repository's migrations.
    const statements = JSON.parse(execFileSync('python3', ['-c',
        'import sqlite3,json,sys,pathlib\nresult=[]\nfor filename in sys.argv[1:]:\n pending=""\n for line in pathlib.Path(filename).read_text().splitlines(True):\n  pending+=line\n  if sqlite3.complete_statement(pending):\n   result.append(pending);pending=""\nprint(json.dumps(result))',
        path.join(root, 'schema.sql'),
        ...['0029_create_appeal_packets.sql', '0030_create_self_appeal_cases.sql', '0031_create_packet_fulfillment.sql', '0032_create_appeal_pilot_access.sql'].map(name => path.join(root, 'migrations', name))
    ], { encoding: 'utf8' }));
    for (const statement of statements) await db.prepare(statement).run();
    await db.prepare("INSERT INTO appeal_pilot_access(email,invited_by) VALUES('owner@example.com','admin@example.com'),('stranger@example.com','admin@example.com')").run();
    await db.prepare("INSERT INTO property_addresses(id,pin,address,normalized_address,taxable_value,home_size,year_built,pin_proration_rate,township_name) VALUES(1,'00000000000001','123 TEST AVE SKOKIE','123 TEST AVE SKOKIE',21000,1450,1965,1,'Niles')").run();
    await db.prepare("INSERT INTO property_addresses(id,pin,address,normalized_address,taxable_value,home_size,year_built,pin_proration_rate) VALUES(2,'00000000000002','125 TEST AVE SKOKIE','125 TEST AVE SKOKIE',22000,1500,1966,1)").run();
    await db.prepare("INSERT INTO user_addresses(id,customer_id,address,property_key,email) VALUES(7,'owner','123 TEST AVE SKOKIE','123 TEST AVE SKOKIE|pin:00000000000001','owner@example.com')").run();
    await db.prepare("WITH RECURSIVE entries(n) AS (SELECT 1000 UNION ALL SELECT n+1 FROM entries WHERE n<100999) INSERT INTO property_addresses(id,pin,address,normalized_address,taxable_value,pin_proration_rate) SELECT n,printf('%014d',n),printf('%d UNRELATED ST',n),printf('%d UNRELATED ST',n),10000,1 FROM entries").run();
}, { timeout: 60000 });
after(async () => { await worker?.dispose(); });

async function api(route, uid = 'owner', body, claims = {}, method = body ? 'POST' : 'GET') {
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const content = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({ sub: uid, email: `${uid}@example.com`, email_verified: true, aud: 'cookcounty-tax-compare', iss: 'https://securetoken.google.com/cookcounty-tax-compare', exp: Math.floor(Date.now() / 1000) + 3600, ...claims })}`;
    const signature = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(content))).toString('base64url');
    const multipart=body instanceof FormData;
    if(multipart) {
        const outgoing=new Request(`https://local.test${route}`,{method,headers:{Authorization:`Bearer ${content}.${signature}`},body});
        return worker.dispatchFetch(outgoing.url,{method,headers:Object.fromEntries(outgoing.headers),body:await outgoing.arrayBuffer()});
    }
    return worker.dispatchFetch(`https://local.test${route}`, { method, headers: { Authorization: `Bearer ${content}.${signature}`, ...(multipart?{}:{'Content-Type':'application/json'}) }, ...(body ? { body: multipart?body:JSON.stringify(body) } : {}) });
}

test('local Worker loads saved properties, starts, opens, and resumes with 100,000 unrelated rows', async t => {
    const summary = await api('/api/addresses?summary=1');
    assert.equal(summary.status, 200, await summary.clone().text());
    assert.deepEqual((await summary.json()).map(row => row.id), [7]);
    assert.match(summary.headers.get('Cache-Control'), /no-store/);
    const started = performance.now();
    const detailed = await api('/api/addresses');
    assert.equal(detailed.status, 200, await detailed.clone().text());
    assert.equal((await detailed.json())[0].propertyDetails.taxableValue, 21000);
    t.diagnostic(`Real local Worker detailed-property request: ${(performance.now() - started).toFixed(1)} ms.`);
    const created = await api('/api/packet-start', 'owner', { propertyId: 7, taxYear: 2026 });
    assert.equal(created.status, 200, await created.clone().text());
    packetId = (await created.json()).id;
    const packet = await api(`/api/packet?id=${packetId}`);
    assert.equal(packet.status, 200, await packet.clone().text());
    const data = await packet.json();
    assert.equal(data.isOwner, true);
    assert.equal(data.appeal.payment_status, 'free');
    assert.equal(data.state.propertySnapshot.propertyId, 7);
    assert.equal(data.state.propertySnapshot.details.taxableValue, 21000);
    const resumed = await api('/api/packet-start', 'owner', { propertyId: 7, taxYear: 2026 });
    assert.equal(resumed.status, 200);
    assert.equal((await resumed.json()).id, packetId);
    assert.equal((await db.prepare('SELECT count(*) AS total FROM appeal_packets').first()).total, 1);
});

test('local Worker denies another account and anonymous access to the appeal', async () => {
    assert.equal((await api('/api/packet-start', 'stranger', { propertyId: 7, taxYear: 2026 })).status, 404);
    assert.equal((await api(`/api/packet?id=${packetId}`, 'stranger')).status, 404);
    const summary = await api('/api/addresses?summary=1', 'stranger');
    assert.deepEqual(await summary.json(), []);
    assert.equal((await worker.dispatchFetch(`https://local.test/api/packet?id=${packetId}`)).status, 401);
});

test('guided answers persist and resume without creating an approved filing packet',async()=>{
    const before=await (await api(`/api/packet?id=${packetId}`)).json();
    const saved=await api(`/api/packet?id=${packetId}`,'owner',{action:'questionnaire',revision:before.revision,step:'contact',answers:{ownerName:'Draft Owner',singleFamilyScope:true,requestedMarketValue:''}});
    assert.equal(saved.status,200,await saved.clone().text());
    const response=await saved.json();assert.equal(response.questionnaire.step,'contact');assert.equal(response.revision,before.revision+1);
    const after=await (await api(`/api/packet?id=${packetId}`)).json();
    assert.equal(after.state.status,'intake');assert.equal(after.state.version,0);assert.equal(after.state.questionnaire.answers.ownerName,'Draft Owner');
    assert.equal(after.state.intake,undefined);assert.equal(after.fulfillmentPaid,false);
    const stale=await api(`/api/packet?id=${packetId}`,'owner',{action:'questionnaire',revision:before.revision,step:'contact',answers:{ownerName:'Stale overwrite'}});
    assert.equal(stale.status,409);
    const stranger=await api(`/api/packet?id=${packetId}`,'stranger',{action:'questionnaire',revision:response.revision,step:'contact',answers:{ownerName:'Another owner'}});
    assert.equal(stranger.status,404);
});

test('free preparation-copy export works before templates exist and does not mutate the case',async()=>{
    const before=await db.prepare('SELECT revision,state_json FROM appeal_packets WHERE transaction_id=?').bind(packetId).first();
    const response=await api(`/api/packet?id=${packetId}&download=preparation`);
    assert.equal(response.status,200,await response.clone().text());
    assert.match(response.headers.get('Content-Type'),/application\/pdf/);
    assert.match(response.headers.get('Content-Disposition'),/preparation-copy.pdf/);
    assert.match(response.headers.get('Cache-Control'),/no-store/);
    const {PDFDocument}=await import('../assets/vendor/pdf-lib.esm.min.js');
    assert.match((await PDFDocument.load(await response.arrayBuffer())).getTitle(),/NOT READY TO FILE/);
    const after=await db.prepare('SELECT revision,state_json FROM appeal_packets WHERE transaction_id=?').bind(packetId).first();
    assert.deepEqual(after,before);
    assert.equal((await api(`/api/packet?id=${packetId}&download=preparation`,'stranger')).status,404);
    assert.equal(stripeSessions.size,0);
});

test('local Worker searches, saves, and reloads a property using its account-owned ID', async () => {
    const lookup=await api('/api/address-lookup?q=125%20TEST%20AVE&limit=5');
    assert.equal(lookup.status,200,await lookup.clone().text());
    const suggestion=(await lookup.json()).suggestions.find(item=>item.address==='125 TEST AVE SKOKIE');
    assert.ok(suggestion);
    const input={address:suggestion.address,propertyKey:suggestion.propertyKey};
    const added=await api('/api/addresses','owner',input);
    assert.equal(added.status,200,await added.clone().text());
    const saved=(await added.json()).savedProperty;
    assert.ok(saved?.id);
    assert.notEqual(saved.id,suggestion.id);
    const summary=await api('/api/addresses?summary=1');
    assert.ok((await summary.json()).some(row=>row.id===saved.id&&row.address===suggestion.address));
    const details=await api(`/api/addresses?propertyId=${saved.id}`);
    assert.equal((await details.json())[0].propertyDetails.taxableValue,22000);
    const duplicate=await api('/api/addresses','owner',input);
    assert.equal((await duplicate.json()).savedProperty.id,saved.id);
    const stranger=await api(`/api/addresses?propertyId=${saved.id}`,'stranger');
    assert.deepEqual(await stranger.json(),[]);
    const created=await api('/api/packet-start','owner',{propertyId:saved.id,taxYear:2026});
    assert.equal(created.status,200,await created.clone().text());
    const opened=await api(`/api/packet?id=${(await created.json()).id}`);
    assert.equal((await opened.json()).state.propertySnapshot.address,suggestion.address);
});

test('local Worker enforces invitation status on start and packet reads independently of the access endpoint', async () => {
    const allowed=await api('/api/appeal-access');
    assert.deepEqual(await allowed.json(),{allowed:true,admin:false});
    assert.match(allowed.headers.get('Cache-Control'),/private.*no-store/);
    const countBefore=(await db.prepare('SELECT count(*) AS total FROM appeals').first()).total;
    await db.prepare("UPDATE appeal_pilot_access SET active=0 WHERE email='owner@example.com'").run();
    try {
        const denied=await api('/api/appeal-access');
        assert.deepEqual(await denied.json(),{allowed:false,admin:false});
        assert.equal((await api('/api/packet-start','owner',{propertyId:7,taxYear:2026})).status,403);
        assert.equal((await api(`/api/packet?id=${packetId}`)).status,403);
        // Account data remains available even when free preparation is paused.
        assert.equal((await api('/api/addresses?summary=1')).status,200);
        assert.equal((await db.prepare('SELECT count(*) AS total FROM appeals').first()).total,countBefore);
        const uninvited={email:'uninvited@example.com'};
        assert.equal((await api('/api/packet-start','owner',{propertyId:7,taxYear:2026},uninvited)).status,403);
    } finally {
        await db.prepare("UPDATE appeal_pilot_access SET active=1 WHERE email='owner@example.com'").run();
    }
    const primary=await api('/api/appeal-access','primary',undefined,{email:'vuchicago@gmail.com'});
    assert.deepEqual(await primary.json(),{allowed:true,admin:true});
    const anonymous=await worker.dispatchFetch('https://local.test/api/appeal-access');
    assert.equal(anonymous.status,401);
    assert.match(anonymous.headers.get('Cache-Control'),/no-store/);
});

test('local Worker saves intake without a deadline and preserves the packet after deleting its saved address',async()=>{
    const before=await api(`/api/packet?id=${packetId}`);
    const packet=await before.json();
    assert.equal(packet.mailingWindow.township,'Niles');
    assert.equal(packet.mailingWindow.opensOn,'2026-10-20');
    const intake={action:'intake',revision:packet.revision,agency:'assessor',taxYear:2026,ownerName:'Test Owner',mailingAddress:'123 Test Ave',reason:'characteristics',explanation:'Incorrect area',individualOwner:true,noExistingAppeal:true,requestedMarketValue:200000,singleFamilyScope:true,ownResidence:true,recordsConfirmed:true,pins:'00000000000001',selectedComparables:[]};
    const saved=await api(`/api/packet?id=${packetId}`,'owner',intake);
    assert.equal(saved.status,200,await saved.clone().text());
    const unauthorized=await api('/api/addresses','stranger',{propertyId:7},{},'DELETE');
    assert.equal(unauthorized.status,404);
    const removed=await api('/api/addresses','owner',{propertyId:7},{},'DELETE');
    assert.equal(removed.status,200,await removed.clone().text());
    assert.equal((await removed.json()).deleted,1);
    const rows=await (await api('/api/addresses?summary=1')).json();
    assert.equal(rows.some(row=>row.id===7),false);
    const retained=await api(`/api/packet?id=${packetId}`);
    assert.equal(retained.status,200,await retained.clone().text());
    const data=await retained.json();
    assert.equal(data.state.intake.ownerName,'Test Owner');
    assert.equal(data.state.intake.filingDeadline,undefined);
    assert.equal(data.state.propertySnapshot.address,'123 TEST AVE SKOKIE');
    assert.equal((await db.prepare('SELECT count(*) AS total FROM appeals WHERE transaction_id=?').bind(packetId).first()).total,1);
});

test('administrator imports one reusable official-form template; owner builds the prefilled packet without uploading an application',async()=>{
    const {formFixture}=await import('./official-form-fixtures.mjs');
    const {PDFDocument}=await import('../assets/vendor/pdf-lib.esm.min.js');
    const fixture=await formFixture();
    const endpoint='/api/admin/appeal-forms?year=2026&kind=application';
    assert.equal((await api(endpoint)).status,403);
    const adminClaims={email:'vuchicago@gmail.com'};
    const post=async data=>{
        const body=new FormData();body.set('data',JSON.stringify(data));body.set('file',new File([fixture.bytes],'synthetic-test-only.pdf',{type:'application/pdf'}));
        return api(endpoint,'primary',body,adminClaims);
    };
    const inspected=await post({action:'inspect'});
    assert.equal(inspected.status,200,await inspected.clone().text());
    assert.ok((await inspected.json()).fields.some(field=>field.name==='primaryPin'));
    const denied=await post({action:'publish',mapping:fixture.manifest.mapping});
    assert.equal(denied.status,400);
    const published=await post({action:'publish',mapping:fixture.manifest.mapping,sourceUrl:fixture.manifest.sourceUrl,officialReviewed:true,mappingReviewed:true,signaturesBlank:true});
    assert.equal(published.status,200,await published.clone().text());
    let packet=await (await api(`/api/packet?id=${packetId}`)).json();
    assert.equal(packet.officialForms[0].ready,true);
    assert.ok(packet.officialForms[0].missingValues.some(value=>value.source==='ownerPhone'));
    const saved=await api(`/api/packet?id=${packetId}`,'owner',{...packet.state.intake,action:'intake',revision:packet.revision,ownerPhone:'3125550100',mailingCity:'Chicago',mailingState:'IL',mailingZip:'60601',propertyCity:'Skokie',documentsReviewed:true});
    assert.equal(saved.status,200,await saved.clone().text());
    packet=await (await api(`/api/packet?id=${packetId}`)).json();
    const evidence=new FormData();
    evidence.set('data',JSON.stringify({action:'evidence',revision:packet.revision,category:'corrections'}));
    evidence.set('file',new File([fixture.bytes],'test-correction-evidence.pdf',{type:'application/pdf'}));
    const uploaded=await api(`/api/packet?id=${packetId}`,'owner',evidence);
    assert.equal(uploaded.status,200,await uploaded.clone().text());
    packet=await (await api(`/api/packet?id=${packetId}`)).json();
    assert.equal(packet.state.documents.some(doc=>doc.category==='application'),false);
    const generated=await api(`/api/packet?id=${packetId}`,'owner',{action:'generate',revision:packet.revision});
    assert.equal(generated.status,200,await generated.clone().text());
    packet=await (await api(`/api/packet?id=${packetId}`)).json();
    assert.equal(packet.state.status,'review');
    const document=packet.state.documents.find(doc=>doc.kind==='packet');
    const download=await api(`/api/packet?id=${packetId}&document=${document.id}`);
    assert.equal(download.status,200);
    const pdf=await PDFDocument.load(await download.arrayBuffer());
    assert.match(pdf.getTitle(),/2026 Assessor appeal/);
    assert.equal(pdf.getPageCount(),5);
    assert.equal(pdf.getForm().getFields().length,0);
    assert.equal((await db.prepare('SELECT count(*) AS total FROM packet_signatures').first()).total,0);
});

test('administrator payment test works with existing live Stripe configuration and never unlocks fulfillment',async()=>{
    await db.prepare("INSERT INTO user_addresses(id,customer_id,address,property_key,email) VALUES(10,'primary','123 TEST AVE SKOKIE','123 TEST AVE SKOKIE|pin:00000000000001','vuchicago@gmail.com')").run();
    const claims={email:'vuchicago@gmail.com'};
    const start=await api('/api/packet-start','primary',{propertyId:10,taxYear:2026},claims);
    assert.equal(start.status,200,await start.clone().text());
    const id=(await start.json()).id;
    const packet=await (await api(`/api/packet?id=${id}`,'primary',undefined,claims)).json();
    assert.equal(packet.checkout.testing,true);assert.equal(packet.checkout.enabled,true);assert.equal(packet.checkout.mode,'live');
    const checkout=await api('/api/create-checkout-session','primary',{packetId:id,fulfillmentAccepted:true,paymentTest:true},claims);
    assert.equal(checkout.status,200,await checkout.clone().text());
    const session=[...stripeSessions.values()].at(-1);
    assert.equal(session.amount_total,4900);assert.equal(session.metadata.paymentTest,'true');
    assert.equal((await db.prepare('SELECT count(*) AS total FROM packet_fulfillment_orders WHERE packet_id=?').bind(id).first()).total,0);
    session.payment_status='paid';session.status='complete';
    const returned=await api(`/api/session-status?session_id=${session.id}`,'primary',undefined,claims);
    assert.equal(returned.status,200,await returned.clone().text());
    assert.equal((await returned.json()).email_status,'not_sent_payment_test');
    const row=await db.prepare('SELECT payment_status,appeal_status FROM appeals WHERE transaction_id=?').bind(session.id).first();
    assert.equal(row.payment_status,'paid');assert.equal(row.appeal_status,'Payment Test');
    assert.equal((await api(`/api/packet?id=${session.id}`,'primary',undefined,claims)).status,409);
    const after=await (await api(`/api/packet?id=${id}`,'primary',undefined,claims)).json();
    assert.equal(after.fulfillmentPaid,false);assert.equal(after.state.version,0);assert.equal(after.state.status,'intake');
    assert.equal((await db.prepare('SELECT count(*) AS total FROM packet_signatures').first()).total,0);
    const unauthorized=await api('/api/create-checkout-session','owner',{packetId,paymentTest:true,fulfillmentAccepted:true});
    assert.equal(unauthorized.status,403);
});

test('new appeal snapshots filter valuations before the 20-comparison limit',async()=>{
    const insert=(id,value)=>db.prepare(`INSERT INTO property_addresses(id,pin,address,normalized_address,taxable_value,home_size,year_built,pin_proration_rate,township_name,class_code,neighborhood_code,certified_land,bedroom_count,bathroom_count,masonry_type,single_vs_multi_family,latitude,longitude)
        VALUES(?,?,?,?,?,1400,1965,1,'Niles','203','LOWER_TEST',5000,3,2,'1','1',?,-87.7)`)
        .bind(id,String(id).padStart(14,'0'),`${id} COMPARISON AVE`,`${id} COMPARISON AVE`,value,42+(id-200000)*0.00001);
    await db.batch([insert(200000,30000),...Array.from({length:21},(_,n)=>insert(200001+n,40000)),...Array.from({length:3},(_,n)=>insert(200022+n,20000+n)),insert(200025,30000),insert(200026,null)]);
    await db.prepare("INSERT INTO user_addresses(id,customer_id,address,property_key,email) VALUES(70,'owner','200000 COMPARISON AVE','200000 COMPARISON AVE|pin:00000000200000','owner@example.com')").run();
    const start=await api('/api/packet-start','owner',{propertyId:70,taxYear:2026});
    assert.equal(start.status,200,await start.clone().text());
    const id=(await start.json()).id;
    const packet=await (await api(`/api/packet?id=${id}`)).json();
    assert.equal(packet.state.propertySnapshot.details.taxableValue,30000);
    assert.deepEqual(packet.state.propertySnapshot.comparables.map(c=>c.pin),[200022,200023,200024].map(id=>String(id).padStart(14,'0')));
    const invalid=await api(`/api/packet?id=${id}`,'owner',{action:'questionnaire',revision:packet.revision,step:'comparisons',answers:{selectedComparables:['00000000200001']}});
    assert.equal(invalid.status,400,await invalid.clone().text());
    const valid=await api(`/api/packet?id=${id}`,'owner',{action:'questionnaire',revision:packet.revision,step:'comparisons',answers:{selectedComparables:packet.state.propertySnapshot.comparables.map(c=>c.pin)}});
    assert.equal(valid.status,200,await valid.clone().text());
});

test('a required property photo and capture date save before completed intake',async()=>{
    await db.prepare("INSERT INTO user_addresses(id,customer_id,address,property_key,email) VALUES(71,'owner','123 TEST AVE SKOKIE','123 TEST AVE SKOKIE|pin:00000000000001','owner@example.com')").run();
    // Use another year: the current-year case for this same owner/property is already in review.
    const start=await api('/api/packet-start','owner',{propertyId:71,taxYear:2025});
    assert.equal(start.status,200,await start.clone().text());const id=(await start.json()).id;
    const packet=await (await api(`/api/packet?id=${id}`)).json();
    const photo=new FormData();photo.set('data',JSON.stringify({action:'evidence',revision:packet.revision,category:'photo',photoDate:'2025-01-01',photoDateStamped:false}));
    photo.set('file',new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yMJcAAAAASUVORK5CYII=','base64')],'front.png',{type:'image/png'}));
    const uploaded=await api(`/api/packet?id=${id}`,'owner',photo);
    assert.equal(uploaded.status,200,await uploaded.clone().text());
    const after=await (await api(`/api/packet?id=${id}`)).json();
    assert.equal(after.state.status,'intake');assert.equal(after.state.intake,undefined);assert.equal(after.state.version,0);
    const saved=after.state.documents.find(doc=>doc.category==='photo');assert.equal(saved.photoDate,'2025-01-01');assert.equal(saved.dateStamped,false);
    assert.ok(after.officialForms.some(form=>form.kind==='photo_attestation'));
});
