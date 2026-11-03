import test from 'node:test';
import assert from 'node:assert/strict';
import { appealAccess, PILOT_ADMIN_EMAIL } from '../functions/api/_appeal_access.js';

function database({ role = null, active = null } = {}) {
    const queries = [];
    return {
        queries,
        prepare(sql) {
            const query = { sql, args: [] };
            queries.push(query);
            return {
                bind(...args) { query.args = args; return this; },
                async first() {
                    if (sql.includes('FROM admins')) {
                        const accepted = !sql.includes("role IN ('admin','superadmin')") || ['admin', 'superadmin'].includes(role);
                        return role && accepted ? { role } : null;
                    }
                    return active === null ? null : { active };
                }
            };
        }
    };
}

test('missing or unverified identities are denied before querying the database', async () => {
    for (const user of [null, {}, { email: PILOT_ADMIN_EMAIL, emailVerified: false }, { emailVerified: true }]) {
        assert.deepEqual(await appealAccess(null, user), { allowed: false, admin: false });
    }
});

test('verified primary administrator retains access without an invitation table', async () => {
    assert.deepEqual(await appealAccess(null, { email: ` ${PILOT_ADMIN_EMAIL.toUpperCase()} `, emailVerified: true }), { allowed: true, admin: true });
});

test('administrators retain access even when their individual invitation is paused', async () => {
    for (const role of ['admin', 'superadmin']) {
        const db = database({ role, active: 0 });
        assert.deepEqual(await appealAccess(db, { email: ' ADMIN@EXAMPLE.COM ', emailVerified: true }), { allowed: true, admin: true });
        assert.deepEqual(db.queries[0].args, ['admin@example.com']);
        assert.equal(db.queries.length, 1);
    }
});

test('partner privileges alone do not grant free appeal access', async () => {
    assert.deepEqual(await appealAccess(database({ role: 'partner' }), { email: 'partner@example.com', emailVerified: true }), { allowed: false, admin: false });
});

test('an invited partner is a tester without administrator privileges', async () => {
    const db = database({ role: 'partner', active: 1 });
    assert.deepEqual(await appealAccess(db, { email: ' TESTER@EXAMPLE.COM ', emailVerified: true }), { allowed: true, admin: false });
    assert.deepEqual(db.queries[1].args, ['tester@example.com']);
});

test('missing, paused, and invalid invitation states deny access', async () => {
    for (const active of [null, 0, 2, '1', true]) {
        assert.deepEqual(await appealAccess(database({ active }), { email: 'tester@example.com', emailVerified: true }), { allowed: false, admin: false });
    }
});

test('database failures cannot silently grant pilot access', async () => {
    const db = { prepare() { throw new Error('database unavailable'); } };
    await assert.rejects(appealAccess(db, { email: 'tester@example.com', emailVerified: true }), /database unavailable/);
});
