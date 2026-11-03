import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequestGet as addresses, onRequestPost as addAddress } from '../functions/api/addresses.js';
import { onRequestPost as start } from '../functions/api/packet-start.js';

const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
jwk.kid = 'saved-properties';
globalThis.fetch = async url => {
    assert.ok(String(url).includes('googleapis.com'), 'These tests must not contact external providers');
    return Response.json({ keys: [jwk] });
};
async function request(path, uid = 'owner', body) {
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const content = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({ sub: uid, email: `${uid}@example.com`, email_verified: true, aud: 'cookcounty-tax-compare', iss: 'https://securetoken.google.com/cookcounty-tax-compare', exp: Math.floor(Date.now() / 1000) + 3600 })}`;
    const signature = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(content))).toString('base64url');
    return new Request(`https://example.test${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${content}.${signature}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
}

function fixture({ large = false } = {}) {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
    for (const migration of ['0029_create_appeal_packets.sql', '0030_create_self_appeal_cases.sql', '0031_create_packet_fulfillment.sql', '0032_create_appeal_pilot_access.sql']) sqlite.exec(readFileSync(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'));
    sqlite.exec(`INSERT INTO appeal_pilot_access(email,invited_by) VALUES('owner@example.com','admin@example.com'),('stranger@example.com','admin@example.com');
        INSERT INTO property_addresses(id,pin,address,normalized_address,taxable_value,certified_land,certified_building,home_size,year_built,pin_proration_rate,mailing_name,township_name)
        VALUES(1,'00000000000001','123 TEST AVE SKOKIE','123 TEST AVE SKOKIE',21000,4000,17000,1450,1965,1,'Test Owner','Niles'),
              (2,'00000000000002','125 TEST AVE SKOKIE','125 TEST AVE SKOKIE',10000,2000,8000,1500,1960,0.5,'Test Owner','Niles'),
              (3,'00000000000003','125 TEST AVE SKOKIE','125 TEST AVE SKOKIE',11000,2200,8800,1500,1960,0.5,'Test Owner','Niles'),
              (4,'00000000000004','125 TEST AVE SKOKIE','125 TEST AVE SKOKIE',99999,1000,98999,900,1980,1,'Other Owner','Niles');
        INSERT INTO user_addresses(id,customer_id,address,property_key,email) VALUES
        (7,'owner','123 TEST AVE SKOKIE','123 TEST AVE SKOKIE|pin:00000000000001','owner@example.com'),
        (8,'owner','125 TEST AVE SKOKIE','125 TEST AVE SKOKIE|fractional','owner@example.com'),
        (9,'stranger','125 TEST AVE SKOKIE','125 TEST AVE SKOKIE|pin:00000000000004','stranger@example.com');`);
    if (large) sqlite.exec(`WITH RECURSIVE entries(n) AS (SELECT 1000 UNION ALL SELECT n+1 FROM entries WHERE n<100999)
        INSERT INTO property_addresses(id,pin,address,normalized_address,taxable_value,pin_proration_rate)
        SELECT n,printf('%014d',n),printf('%d UNRELATED ST',n),printf('%d UNRELATED ST',n),10000,1 FROM entries;`);
    const queries = [];
    function execute(statement, mode) {
        const { sql, args } = statement;
        const plan = /^\s*SELECT\b/i.test(sql) ? sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map(row => row.detail) : [];
        queries.push({ sql, args, plan });
        const prepared = sqlite.prepare(sql);
        if (mode === 'first') return prepared.get(...args) || null;
        if (mode === 'all') return { results: prepared.all(...args) };
        const result = prepared.run(...args);
        return { meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
    }
    function prepare(sql, args = []) {
        return { sql, args, bind(...values) { return prepare(sql, values); }, async first() { return execute(this, 'first'); }, async all() { return execute(this, 'all'); }, async run() { return execute(this, 'run'); } };
    }
    const DB = { prepare, async batch(statements) {
        sqlite.exec('BEGIN');
        try { const result = statements.map(statement => execute(statement, 'run')); sqlite.exec('COMMIT'); return result; }
        catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    } };
    return { DB, sqlite, queries, close: () => sqlite.close() };
}

test('saved-property picker reads only the authenticated account without enriching the property table', async () => {
    const f = fixture();
    try {
        const response = await addresses({ request: await request('/api/addresses?summary=1'), env: f });
        assert.equal(response.status, 200);
        const rows = await response.json();
        assert.deepEqual(rows.map(row => row.id).sort(), [7, 8]);
        assert.equal(f.queries.some(query => query.sql.includes('FROM property_addresses')), false);
    } finally { f.close(); }
});

test('detailed account properties use indexed lookups with 100,000 unrelated properties', async t => {
    const f = fixture({ large: true });
    try {
        const started = performance.now();
        const response = await addresses({ request: await request('/api/addresses'), env: f });
        assert.equal(response.status, 200);
        const rows = await response.json();
        assert.equal(rows.find(row => row.id === 7).propertyDetails.taxableValue, 21000);
        const fractional = rows.find(row => row.id === 8);
        assert.equal(fractional.propertyDetails.taxableValue, 21000);
        assert.equal(fractional.propertyDetails.pinCount, 2);
        assert.equal(fractional.pin, '00000000000002, 00000000000003');
        const plans = f.queries.flatMap(query => query.plan);
        assert.equal(plans.some(plan => /SCAN property_addresses\b/.test(plan)), false, plans.join('\n'));
        assert.ok(plans.some(plan => /SEARCH property_addresses USING INDEX/.test(plan)), plans.join('\n'));
        t.diagnostic(`Loaded two detailed saved properties in ${(performance.now() - started).toFixed(1)} ms with 100,000 unrelated rows.`);
    } finally { f.close(); }
});

test('starting a new appeal hydrates only its owned property and retry resumes the same workspace', async () => {
    const f = fixture();
    try {
        const make = async () => start({ request: await request('/api/packet-start', 'owner', { propertyId: 7, taxYear: 2026 }), env: f });
        const response = await make();
        assert.equal(response.status, 200, await response.clone().text());
        const first = await response.json();
        const saved = JSON.parse(f.sqlite.prepare('SELECT state_json FROM appeal_packets WHERE transaction_id=?').get(first.id).state_json);
        assert.equal(saved.propertySnapshot.propertyId, 7);
        assert.equal(saved.propertySnapshot.details.taxableValue, 21000);
        assert.equal(f.queries.some(query => /FROM user_addresses/.test(query.sql) && !/\bid\s*=\s*\?/.test(query.sql)), false, 'Appeal start must not reload the entire saved-property list');
        assert.equal(f.queries.some(query => query.args.includes('125 TEST AVE SKOKIE|fractional')), false, 'Another saved property must not block this appeal');
        const second = await make();
        assert.equal(second.status, 200);
        assert.equal((await second.json()).id, first.id);
        assert.equal(f.sqlite.prepare('SELECT count(*) AS total FROM appeal_packets').get().total, 1);
    } finally { f.close(); }
});

test('another account cannot start or inspect the selected saved property', async () => {
    const f = fixture();
    try {
        const response = await start({ request: await request('/api/packet-start', 'stranger', { propertyId: 7, taxYear: 2026 }), env: f });
        assert.equal(response.status, 404);
        assert.equal(f.queries.some(query => query.sql.includes('FROM property_addresses')), false);
        assert.equal(f.sqlite.prepare('SELECT count(*) AS total FROM appeal_packets').get().total, 0);
    } finally { f.close(); }
});

test('adding a selected property uses the normalized-address index', async () => {
    const f = fixture();
    try {
        f.sqlite.prepare('DELETE FROM user_addresses WHERE id=7').run();
        const response = await addAddress({ request: await request('/api/addresses', 'owner', { address: '123 TEST AVE SKOKIE', propertyKey: '123 TEST AVE SKOKIE|pin:00000000000001' }), env: f });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).property.pin, '00000000000001');
        const plans = f.queries.flatMap(query => query.plan);
        assert.equal(plans.some(plan => /SCAN property_addresses\b/.test(plan)), false, plans.join('\n'));
        assert.ok(plans.some(plan => /SEARCH property_addresses USING INDEX/.test(plan)));
    } finally { f.close(); }
});
