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
        outboundService: async request => {
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
    return worker.dispatchFetch(`https://local.test${route}`, { method, headers: { Authorization: `Bearer ${content}.${signature}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
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
    const intake={action:'intake',revision:packet.revision,agency:'assessor',taxYear:2026,ownerName:'Test Owner',mailingAddress:'123 Test Ave',reason:'characteristics',explanation:'Incorrect area',individualOwner:true,noExistingAppeal:true,requestedMarketValue:200000,residentialScope:true,ownResidence:true,recordsConfirmed:true,pins:'00000000000001',selectedComparables:[]};
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
