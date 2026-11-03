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
    await db.prepare("INSERT INTO property_addresses(id,pin,address,normalized_address,taxable_value,home_size,year_built,pin_proration_rate) VALUES(1,'00000000000001','123 TEST AVE SKOKIE','123 TEST AVE SKOKIE',21000,1450,1965,1)").run();
    await db.prepare("INSERT INTO user_addresses(id,customer_id,address,property_key,email) VALUES(7,'owner','123 TEST AVE SKOKIE','123 TEST AVE SKOKIE|pin:00000000000001','owner@example.com')").run();
    await db.prepare("WITH RECURSIVE entries(n) AS (SELECT 1000 UNION ALL SELECT n+1 FROM entries WHERE n<100999) INSERT INTO property_addresses(id,pin,address,normalized_address,taxable_value,pin_proration_rate) SELECT n,printf('%014d',n),printf('%d UNRELATED ST',n),printf('%d UNRELATED ST',n),10000,1 FROM entries").run();
}, { timeout: 60000 });
after(async () => { await worker?.dispose(); });

async function api(route, uid = 'owner', body) {
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const content = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({ sub: uid, email: `${uid}@example.com`, email_verified: true, aud: 'cookcounty-tax-compare', iss: 'https://securetoken.google.com/cookcounty-tax-compare', exp: Math.floor(Date.now() / 1000) + 3600 })}`;
    const signature = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(content))).toString('base64url');
    return worker.dispatchFetch(`https://local.test${route}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${content}.${signature}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
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
