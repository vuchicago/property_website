// Browser tests run only against a local server. Firebase and every API call are fixtures.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const base = new URL(process.env.APPEAL_TEST_BASE_URL || 'http://127.0.0.1:8788');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Browser regression tests require a loopback server.');
let chromium;
try { ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core')); }
catch { throw new Error('Install playwright-core locally, or set PLAYWRIGHT_MODULE to an installed Playwright module. See TESTING.md.'); }
const installedChrome = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    ...(process.env.PROGRAMFILES ? [path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe')] : [])
].find(candidate => fs.existsSync(candidate));
let browser;
before(async () => {
    const response = await fetch(base).catch(() => null);
    assert.ok(response?.ok, 'Start ./scripts/appeal-local.sh in another terminal before running browser tests.');
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE || installedChrome ? { executablePath: process.env.BROWSER_EXECUTABLE || installedChrome } : {}) });
});
after(async () => { await browser?.close(); });

const property = { id: 7, address: '123 TEST AVE SKOKIE', pin: '00000000000001', property_key: 'test-property' };
const suggestedProperty = { id: 900002, address: '125 TEST AVE SKOKIE', pin: '00000000000002', propertyKey: '125 TEST AVE SKOKIE|pin:00000000000002' };
const menus = {
    Products: [['Property Tax Tool', 'property-tax.html'], ['ROI Tool', 'roi-calculator.html'], ['Loan Tool', 'loan-tool.html']],
    Solutions: [['How Taxes Work', 'how-property-taxes-work.html'], ['FAQ', 'index.html#faq']],
    Company: [['Partners', 'partners.html'], ['Contact', 'contact.html']]
};

function firebaseSource(identity, options = {}) {
    return `
        const callbacks = new Set();
        const identity = ${JSON.stringify(identity)};
        let resolveReady;
        const ready = new Promise(resolve => { resolveReady = resolve; });
        let cachedToken = 'regression-token';
        const makeUser = value => value ? {...value, reload: async()=>{ window.__regressionReloads = (window.__regressionReloads || 0) + 1; if (${Boolean(options.refreshVerified)}) auth.currentUser.emailVerified = true; }, getIdToken: async force => { if (force) { window.__regressionTokenRefreshes = (window.__regressionTokenRefreshes || 0) + 1; cachedToken = 'regression-fresh-token'; } return cachedToken; }, providerData: []} : null;
        const subscribe = callback => { callbacks.add(callback); ready.then(()=>{ if(callbacks.has(callback)) callback(auth.currentUser); }); return ()=>callbacks.delete(callback); };
        const auth = { currentUser: null, onAuthStateChanged: subscribe, authStateReady: ()=>ready };
        const restore = ()=>{ auth.currentUser = sessionStorage.getItem('regression-signed-out') || (${Boolean(options.startSignedOut)} && !sessionStorage.getItem('regression-signed-in')) ? null : makeUser(identity); resolveReady(); };
        if (${Number(options.restoreDelay) || 0}) setTimeout(restore, ${Number(options.restoreDelay) || 0}); else restore();
        window.__setRegressionUser = value => { auth.currentUser = makeUser(value); for(const callback of callbacks) queueMicrotask(()=>callback(auth.currentUser)); };
        export const getAuth = ()=>auth;
        export const onAuthStateChanged = (auth, callback)=>subscribe(callback);
        export const signOut = async()=>{ sessionStorage.setItem('regression-signed-out','1'); sessionStorage.setItem('regression-sign-outs', String(Number(sessionStorage.getItem('regression-sign-outs') || 0)+1)); window.__setRegressionUser(null); };
        export const browserLocalPersistence = {};
        export const setPersistence = async()=>{};
        export const signInWithEmailAndPassword = async()=>{ sessionStorage.removeItem('regression-signed-out'); sessionStorage.setItem('regression-signed-in','1'); window.__setRegressionUser(identity); return {user:auth.currentUser}; };
        export const createUserWithEmailAndPassword = async()=>({user:auth.currentUser});
        export class GoogleAuthProvider {}
        export const signInWithPopup = async()=>({user:auth.currentUser});
        export const sendEmailVerification = async()=>{};
        export const sendPasswordResetEmail = async()=>{};
    `;
}

async function scenario(options = {}) {
    const identity = options.email ? { uid: 'regression-owner', email: options.email, emailVerified: options.verified !== false } : null;
    const store = { contacts: [], starts: [], pilots: [], unexpected: [], requests: [], contactFails: false, accessFails: false, addressesFailsLeft: 0, startFailsLeft: 0, packetFailsLeft: 0, historyFails: false, historyRequests: 0, access: Boolean(options.access), packetStatus: options.packetStatus || 'approved', signatureCalls: 0 };
    store.addresses = [...(options.properties || [property])];
    store.addressPosts = [];
    store.addressDeletes = [];
    store.intakes = [];
    store.intake = options.intake || {singleFamilyScope:true};
    store.publishedForms=[];
    store.checkoutRequests=[];
    store.questionnaire=options.questionnaire || null;
    store.packetRevision=0;
    store.packetVersion=1;
    store.packetGenerated=0;
    store.reviseRequests=0;
    store.approval=options.approval;
    store.packetDocuments=options.documents || [{id:'prepared',kind:'packet',version:1,name:'test-appeal.pdf'}];
    store.lookups = [];
    store.summaryRequests = 0;
    store.authAttempts = [];
    store.history = options.history || [];
    const gates = {}, releases = [], pendingResponses = [];
    for (const name of ['History','Roles','Access','Properties']) {
        gates[name] = new Promise(resolve => {
            store[`release${name}`] = resolve;
            releases.push(resolve);
            if (!options[`hold${name}`]) resolve();
        });
    }
    const deferred = (name, action) => {
        const response = gates[name].then(action);
        pendingResponses.push(response);
        return response;
    };
    const context = await browser.newContext({ viewport: { width: options.width || 1440, height: 900 }, reducedMotion: 'reduce' });
    await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        const json = (body, status = 200) => route.fulfill({ status, json: body });
        if (url.pathname.endsWith('/firebase-app.js')) return route.fulfill({ contentType: 'text/javascript', body: 'export const initializeApp=()=>({});' });
        if (url.pathname.endsWith('/firebase-analytics.js')) return route.fulfill({ contentType: 'text/javascript', body: 'export const getAnalytics=()=>({});' });
        if (url.pathname.endsWith('/firebase-auth.js')) return route.fulfill({ contentType: 'text/javascript', body: firebaseSource(identity, options) });
        if (url.origin !== base.origin) return route.fulfill({ contentType: request.resourceType() === 'document' ? 'text/html' : request.resourceType() === 'stylesheet' ? 'text/css' : 'text/javascript', body: '' });
        if (!url.pathname.startsWith('/api/')) return route.continue();
        store.requests.push(url.pathname + url.search);
        store.authAttempts.push({path:url.pathname, method:request.method(), token:request.headers().authorization, body:request.postData()});
        if (options.alwaysUnauthorized || (options.rejectCachedToken && request.headers().authorization === 'Bearer regression-token')) return json({error:'Unauthorized'},401);
        switch (url.pathname) {
            case '/api/create-checkout-session':
                store.checkoutRequests.push(request.postDataJSON());
                return json({url:new URL('/return.html?session_id=cs_fixture',base).href,stripeMode:options.checkout?.mode || 'test'});
            case '/api/session-status': return json({status:'complete',payment_status:'paid',db_status:'payment_test_recorded',metadata:{paymentTest:'true',packetId:'free_fixture'}});
            case '/api/admin/appeal-forms': {
                if (!['admin','superadmin'].includes(options.role)) return json({error:'Unauthorized. Admin only.'},403);
                const values={ownerName:'Legal owner name',primaryPin:'Primary PIN'};
                if(request.method()==='GET')return json({year:Number(url.searchParams.get('year')),kind:url.searchParams.get('kind'),published:null,sourceUrl:'https://www.cookcountyassessoril.gov/form-document/residential-appeal-form',values});
                const body=await new Request(request.url(),{method:'POST',headers:request.headers(),body:request.postDataBuffer()}).formData();
                const data=JSON.parse(body.get('data'));
                if(data.action==='inspect')return json({pages:1,fields:[{name:'ownerName',type:'PDFTextField',signature:false},{name:'Owner Signature',type:'PDFTextField',signature:true}],values});
                store.publishedForms.push(data);return json({success:true,revision:'fixture-template-revision'});
            }
            case '/api/appeal-access': return deferred('Access', () => store.accessFails ? json({ error: 'Test access service unavailable' }, 503) : json({ allowed: store.access, admin: ['admin', 'superadmin'].includes(options.role) }));
            case '/api/addresses': {
                if (request.method() === 'DELETE') {
                    const entry=request.postDataJSON();
                    store.addressDeletes.push(entry);
                    if (store.deleteFails) return json({error:'Test deletion failure'},503);
                    const saved=store.addresses.find(row=>row.id===entry.propertyId);
                    if (!saved) return json({error:'Saved property not found.'},404);
                    store.addresses=store.addresses.filter(row=>row.id!==entry.propertyId);
                    return json({success:true,deleted:1,propertyId:entry.propertyId});
                }
                if (request.method() === 'POST') {
                    const entry = request.postDataJSON();
                    store.addressPosts.push(entry);
                    let saved = store.addresses.find(row => row.property_key === entry.propertyKey);
                    if (!saved) {
                        saved = { id: Math.max(7,...store.addresses.map(row => row.id)) + 1, address: entry.address, property_key: entry.propertyKey };
                        store.addresses.unshift(saved);
                    }
                    return json({ success: true, savedProperty: saved, property: suggestedProperty });
                }
                if (store.addressesFailsLeft > 0) { store.addressesFailsLeft--; return json({ error: 'Test property loading failure' }, 503); }
                const rows = JSON.parse(JSON.stringify(store.addresses));
                if (url.searchParams.has('propertyId')) return json(rows.filter(row => String(row.id) === url.searchParams.get('propertyId')).map(row => ({...row, propertyDetails:{recordId:900002,taxableValue:21000,homeSize:1450,yearBuilt:1965,townshipName:'Niles'}})));
                if (url.searchParams.get('summary') === '1') { store.summaryRequests++; return deferred('Properties', () => json(rows)); }
                return json(rows);
            }
            case '/api/history': {
                store.historyRequests++;
                return deferred('History', () => store.historyFails ? json({ error: 'Test history failure' }, 503) : json(store.history));
            }
            case '/api/notifications':
            case '/api/admin/notifications': return json({ notifications: [] });
            case '/api/admin/roles': return deferred('Roles', () => options.role ? json(url.searchParams.has('checkRoleOnly') ? { role: options.role } : { roles: [] }) : json({ error: 'Unauthorized' }, 403));
            case '/api/admin/partners': return json({ partners: [] });
            case '/api/admin/appeals':
            case '/api/partner/appeals': return json([]);
            case '/api/admin/appeal-pilots': {
                if (request.method() === 'POST') {
                    const data = request.postDataJSON();
                    store.pilots = [{ email: data.email, active: Number(data.active), invited_by: options.email }];
                    return json({ success: true });
                }
                return json({ pilots: store.pilots });
            }
            case '/api/property/suggest': return json({ suggestions: [] });
            case '/api/address-lookup': store.lookups.push(url.searchParams.get('q')); return json({suggestions:[suggestedProperty]});
            case '/api/contact':
                store.contacts.push(request.postDataJSON());
                return store.contactFails ? json({ error: 'Test submission failure' }, 503) : json({ success: true, captured: true, emailSent: false });
            case '/api/packet-start':
                if (!store.access) return json({ error:'Free appeal testing is currently by invitation.' },403);
                store.starts.push(request.postDataJSON());
                if (store.startFailsLeft > 0) { store.startFailsLeft--; return json({ error: 'Test appeal start failure' }, 503); }
                return json({ id: 'free_fixture', url: 'appeal-packet.html?id=free_fixture' });
            case '/api/packet': {
                if (!store.access) return json({ error: 'Free appeal testing is currently by invitation.' }, 403);
                if (request.method() === 'POST') {
                    let data,uploaded;
                    if((request.headers()['content-type'] || '').startsWith('multipart/form-data')) {
                        const body=await new Request(request.url(),{method:'POST',headers:request.headers(),body:request.postDataBuffer()}).formData();
                        data=JSON.parse(body.get('data'));uploaded=body.get('file');
                    } else data=request.postDataJSON();
                    if(data.revision!==store.packetRevision)return json({error:'Test stale revision'},409);
                    if(data.action==='questionnaire' && store.draftFailsLeft>0){store.draftFailsLeft--;return json({error:'Temporary answer saving failure'},503);}
                    if(data.action==='questionnaire') {store.questionnaire={answers:data.answers,step:data.step};return json({success:true,revision:++store.packetRevision,questionnaire:store.questionnaire});}
                    if(data.action==='evidence') {store.packetDocuments.push({id:`evidence-${store.packetDocuments.length}`,kind:'evidence',category:data.category,name:uploaded.name,type:uploaded.type,version:1,photoDate:data.photoDate,dateStamped:data.photoDateStamped===true});return json({success:true,revision:++store.packetRevision});}
                    if(data.action==='generate') {store.packetGenerated++;store.packetStatus='review';store.packetVersion++;store.packetId=`generated-${store.packetGenerated}`;store.packetDocuments.push({id:store.packetId,kind:'packet',version:store.packetVersion,name:'generated-appeal.pdf'});return json({success:true,revision:++store.packetRevision});}
                    if(data.action==='revise') {
                        store.reviseRequests++;
                        if(store.reviseFails)return json({error:'Temporary edit failure. Please try again.'},503);
                        if(!['review','approved','awaiting_signature','signed'].includes(store.packetStatus) || (options.signature && options.signature.status!=='voided'))return json({error:'This version cannot be revised.'},409);
                        store.packetStatus='preparing';store.approval=undefined;return json({success:true,revision:++store.packetRevision});
                    }
                    if (data.action==='intake') {
                        store.intakes.push(data);store.intake=data;store.packetStatus='preparing';
                        return json({success:true,revision:++store.packetRevision});
                    }
                    return json({error:'Unexpected packet action'},400);
                }
                if (url.searchParams.has('document')) {
                    if(store.packetDownloadFails)return json({error:'Temporary packet download failure. Please try again.'},503);
                    return route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.7\nRegression test fixture\n%%EOF' });
                }
                if (url.searchParams.get('download')==='preparation') {
                    if(store.preparationDownloadFails)return json({error:'Temporary packet download failure. Please try again.'},503);
                    return route.fulfill({contentType:'application/pdf',headers:{'Content-Disposition':'attachment; filename="assessor-2026-preparation-copy.pdf"'},body:'%PDF-1.7\nPreparation copy test fixture\n%%EOF'});
                }
                if (store.packetFailsLeft > 0) { store.packetFailsLeft--; return json({ error: 'Test packet loading failure' }, 503); }
                const chosen = store.addresses.find(row => row.id === store.starts.at(-1)?.propertyId) || property;
                return json({
                    appeal: { customer_name: 'Test Owner', property_address: chosen.address, payment_status: 'free' },
                    state: { status: store.packetStatus, version: store.packetVersion, packetId:store.packetId, signedId:options.signedId, approval:store.approval, taxYear: 2026, intake:store.intake, questionnaire:store.questionnaire, mailingConsent:options.mailingConsent ? {version:1} : undefined, documents: store.packetDocuments, propertySnapshot: { address: chosen.address, pin: chosen.pin || suggestedProperty.pin,details:options.propertyDetails,comparables:options.comparables } },
                    officialForms:options.officialForms,
                    checkout:options.checkout,
                    mailingWindow:options.mailingWindow, signature:options.signature,
                    revision: store.packetRevision, events: options.events || [], isOwner: true, isAdmin: Boolean(options.role === 'admin'), storageReady: true, fulfillmentPaid:Boolean(options.fulfillmentPaid)
                });
            }
            case '/api/packet-signature': store.signatureCalls++; return json({ error: 'Payment required' }, 402);
            default: store.unexpected.push(`${request.method()} ${url.pathname}`); return json({ error: 'Unexpected regression test API' }, 501);
        }
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(7000);
    return {
        page, store,
        goto: route => page.goto(new URL(route, base).href, { waitUntil: 'load' }),
        async close() {
            releases.forEach(release => release());
            await Promise.allSettled(pendingResponses);
            await context.close();
            assert.deepEqual(errors, [], 'Browser JavaScript errors');
            assert.deepEqual(store.unexpected, [], 'Unmocked API requests');
        }
    };
}

async function assertHeader(page, width) {
    await page.locator('.mobile-nav-group').first().waitFor({ state: 'attached' });
    const bounds = await page.evaluate(() => {
        const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { left: r.left, right: r.right }; };
        return { logo: rect('.navbar .logo'), links: rect('.nav-links'), actions: rect('.nav-actions'), header: rect('.nav-container') };
    });
    assert.ok(bounds.header.left >= 0 && bounds.header.right <= width + 1, `Header exceeds ${width}px`);
    assert.ok(bounds.logo.right <= (width > 860 ? bounds.links.left : bounds.actions.left) + 1, `Logo overlaps navigation at ${width}px`);
    assert.ok(bounds.actions.right <= width + 1, `Actions exceed ${width}px`);
    if (width > 860) {
        assert.ok(bounds.links.right <= bounds.actions.left + 1, `Menus overlap actions at ${width}px`);
        const insurance=page.locator('.nav-links > li').last().getByRole('link',{name:'Insurance',exact:true});
        assert.equal(await insurance.isVisible(),true);assert.equal(await insurance.getAttribute('href'),'insurance.html');
        for (const [label, links] of Object.entries(menus)) {
            const trigger = page.locator('.nav-links').getByRole('button', { name: label, exact: true });
            assert.equal(await trigger.isVisible(), true);
            const actual = await trigger.locator('..').locator('.nav-dropdown-menu a').evaluateAll(items => items.map(a => [a.textContent, a.getAttribute('href')]));
            assert.deepEqual(actual, links);
        }
    } else {
        assert.equal(await page.locator('.nav-links').isVisible(), false);
        await page.getByRole('button', { name: 'Open menu', exact: true }).click();
        assert.equal(await page.locator('.mobile-menu').isVisible(), true);
        assert.equal(await page.locator('.mobile-nav-group').count(), 3);
        assert.equal(await page.locator('.mobile-nav-insurance').getByRole('link',{name:'Insurance',exact:true}).isVisible(),true);
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('button', { name: 'Open menu', exact: true }).getAttribute('aria-expanded'), 'false');
    }
}

for (const route of ['/', '/property-tax.html', '/roi-calculator.html', '/loan-tool.html', '/insurance.html', '/contact.html', '/how-property-taxes-work.html', '/partners.html', '/about-cook-county-tax-compare.html', '/privacy-policy.html', '/cook-county-property-tax-appeal.html', '/admin.html']) {
    test(`shared navigation remains usable on desktop, tablet, and mobile: ${route}`, async () => {
        const s = await scenario();
        try {
            await s.goto(route);
            for (const width of [1440, 900, 390]) {
                await s.page.setViewportSize({ width, height: 900 });
                await assertHeader(s.page, width);
            }
        } finally { await s.close(); }
    });
}

test('home header and page fit narrow screens and navigation breakpoints', async () => {
    const s = await scenario();
    try {
        await s.goto('/');
        for (const width of [1150, 1100, 1024, 861, 860, 768, 320]) {
            await s.page.setViewportSize({ width, height: 900 });
            await assertHeader(s.page, width);
            assert.ok(await s.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Page overflows at ${width}px`);
        }
        await s.page.locator('#theme-toggle').click();
        await assertHeader(s.page, 320);
    } finally { await s.close(); }
});

test('landing waitlist sits below How Appeals Work with matching button dimensions', async () => {
    const s = await scenario();
    try {
        await s.goto('/');
        assert.equal(await s.page.locator('.waitlist-border-light, .waitlist-stat').count(), 0);
        for (const width of [1440, 900, 390, 320]) {
            await s.page.setViewportSize({ width, height: 900 });
            const how = await s.page.locator('.hero-secondary-actions').getByRole('link', { name: 'How Appeals Work', exact: true }).boundingBox();
            const waitlist = s.page.locator('.hero-secondary-actions').getByRole('link', { name: 'Appeal Waitlist', exact: true });
            const box = await waitlist.boundingBox();
            assert.ok(box.y >= how.y + how.height, `Waitlist must sit below How Appeals Work at ${width}px`);
            assert.ok(Math.abs(box.width - how.width) <= 1 && Math.abs(box.height - how.height) <= 1, `Button dimensions differ at ${width}px`);
            assert.equal(await waitlist.getAttribute('href'), '#contact');
        }
    } finally { await s.close(); }
});

test('dropdowns support hover, keyboard activation, and Escape including a hovered menu', async () => {
    const s = await scenario();
    try {
        await s.goto('/');
        const trigger = s.page.getByRole('button', { name: 'Products', exact: true });
        const menu = s.page.locator('#site-nav-menu-0');
        await trigger.hover();
        assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
        assert.equal(await menu.evaluate(el => getComputedStyle(el).pointerEvents), 'auto');
        await s.page.keyboard.press('Escape');
        assert.equal(await menu.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
        await s.page.mouse.move(0, 850);
        await trigger.focus();
        await s.page.keyboard.press('Enter');
        assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
        await s.page.keyboard.press('Tab');
        assert.equal(await s.page.evaluate(() => document.activeElement.textContent), 'Property Tax Tool');
        await s.page.keyboard.press('Escape');
        assert.equal(await trigger.evaluate(el => document.activeElement === el), true);
        assert.equal(await menu.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    } finally { await s.close(); }
});

test('current product and company pages remain marked active on clean URLs', async () => {
    const s = await scenario();
    try {
        for (const [route, label] of [['/property-tax/', 'Property Tax Tool'], ['/partners/', 'Partners']]) {
            await s.goto(route);
            assert.equal(await s.page.locator('.nav-links').getByRole('link', { name: label, exact: true }).getAttribute('aria-current'), 'page');
        }
    } finally { await s.close(); }
});

for (const account of [
    { label: 'member', email: 'member@example.com', access: false },
    { label: 'invited tester', email: 'tester@example.com', access: true },
    { label: 'partner', email: 'partner@example.com', role: 'partner', access: false, workspace: 'Partner Inbox' },
    { label: 'administrator', email: 'vuchicago@gmail.com', role: 'superadmin', access: true, workspace: 'Admin' }
]) {
    test(`account actions and free appeal visibility: ${account.label}`, async () => {
        const s = await scenario(account);
        try {
            await s.goto('/');
            await s.page.locator('#address-list a').first().waitFor();
            const free = s.page.locator('#address-list').getByRole('link', { name: 'Prepare my appeal', exact: true });
            assert.equal(await free.count(), account.access ? 1 : 0);
            assert.equal(await s.page.locator('#address-list').getByRole('link', { name: 'Join appeal waitlist', exact: true }).count(), account.access ? 0 : 1);
            assert.equal(await s.page.locator('#my-packet-workspace').isVisible(), account.access);
            for (const width of [1440, 900, 390]) {
                await s.page.setViewportSize({ width, height: 900 });
                await assertHeader(s.page, width);
                if (width > 860) await s.page.getByRole('button', { name: 'Account menu' }).click();
                else await s.page.getByRole('button', { name: 'Open menu', exact: true }).click();
                const scope = s.page.locator(width > 860 ? '.account-menu .nav-dropdown-menu' : '.mobile-menu');
                assert.equal(await scope.getByRole('link', { name: 'My Account', exact: true }).isVisible(), true);
                assert.equal(await scope.getByRole('link', { name: 'Logout', exact: true }).isVisible(), true);
                if (account.workspace) await scope.getByRole('link', { name: account.workspace, exact: true }).waitFor();
                else assert.equal(await scope.locator('[data-role-workspace], [data-mobile-workspace] a').count(), 0);
                await s.page.keyboard.press('Escape');
            }
        } finally { await s.close(); }
    });
}

test('logout clears signed-in actions and hides the account dashboard', async () => {
    const s = await scenario({ email: 'member@example.com' });
    try {
        await s.goto('/');
        await s.page.getByRole('button', { name: 'Account menu' }).click();
        await s.page.locator('.account-menu').getByRole('link', { name: 'Logout', exact: true }).click();
        await s.page.locator('.header-login').waitFor();
        assert.equal(await s.page.locator('#user-dashboard').isVisible(), false);
        assert.equal(await s.page.locator('.account-menu').count(), 0);
    } finally { await s.close(); }
});

for (const email of [null, 'member@example.com']) {
    test(`public waitlist submits without phone or a selected suggestion: ${email ? 'signed in' : 'anonymous'}`, async () => {
        const s = await scenario({ email, width: 390 });
        try {
            await s.goto('/#contact');
            await s.page.locator('#name').fill('Test Owner');
            await s.page.locator('#email').fill('owner@example.com');
            const suggestions = s.page.waitForResponse(response => new URL(response.url()).pathname === '/api/property/suggest');
            await s.page.locator('#property-address-contact').fill(property.address);
            await suggestions;
            await s.page.locator('#property-address-contact').press('Escape');
            const sent = s.page.waitForResponse(response => new URL(response.url()).pathname === '/api/contact');
            await s.page.locator('#contact-form').getByRole('button', { name: 'Join Waitlist' }).click();
            await sent;
            await s.page.waitForFunction(() => document.getElementById('name').value === '');
            assert.equal(s.store.contacts.length, 1);
            assert.equal(s.store.contacts[0].propertyAddress, property.address);
            assert.equal(s.store.contacts[0].phone, '');
            assert.equal(s.store.contacts[0].inquiryType, 'property-tax-waitlist');
        } finally { await s.close(); }
    });
}

test('failed waitlist submission preserves details and permits retry', async () => {
    const s = await scenario();
    try {
        s.store.contactFails = true;
        await s.goto('/#contact');
        await s.page.locator('#name').fill('Test Owner');
        await s.page.locator('#email').fill('owner@example.com');
        const suggestions = s.page.waitForResponse(response => new URL(response.url()).pathname === '/api/property/suggest');
        await s.page.locator('#property-address-contact').fill(property.address);
        await suggestions;
        await s.page.locator('#property-address-contact').press('Escape');
        await s.page.locator('#contact-form').getByRole('button', { name: 'Join Waitlist' }).click();
        await s.page.getByText('Test submission failure', { exact: true }).waitFor();
        assert.equal(await s.page.locator('#name').inputValue(), 'Test Owner');
        assert.equal(await s.page.locator('#contact-form button').isEnabled(), true);
    } finally { await s.close(); }
});

test('administrator can grant, pause, and restore tester access', async () => {
    const s = await scenario({ email: 'admin@example.com', role: 'admin', access: true });
    try {
        await s.goto('/admin.html');
        await s.page.getByRole('button', { name: 'Free Appeal Testers', exact: true }).click();
        await s.page.locator('#pilot-email').fill('tester@example.com');
        await s.page.getByRole('button', { name: 'Grant Test Access' }).click();
        await s.page.locator('#pilot-access-list').getByRole('button', { name: 'Pause', exact: true }).waitFor();
        assert.equal(s.store.pilots[0].active, 1);
        await s.page.getByRole('button', { name: 'Pause', exact: true }).click();
        await s.page.getByRole('button', { name: 'Restore', exact: true }).waitFor();
        assert.equal(s.store.pilots[0].active, 0);
        await s.page.getByRole('button', { name: 'Restore', exact: true }).click();
        await s.page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
        assert.equal(s.store.pilots[0].active, 1);
    } finally { await s.close(); }
});

test('uninvited account gets the waitlist instead of free preparation controls', async () => {
    const s = await scenario({ email: 'member@example.com' });
    try {
        await s.goto('/appeal-packet.html');
        await s.page.waitForFunction(() => document.getElementById('packet-message').textContent.includes('invitation'));
        assert.equal(await s.page.locator('#packet-orders').isVisible(), false);
        assert.equal(await s.page.locator('#packet-waitlist').isVisible(), true);
        assert.equal(s.store.starts.length, 0);
    } finally { await s.close(); }
});

test('invited owner starts a saved-property appeal and downloads before optional fulfillment', async () => {
    const s = await scenario({ email: 'tester@example.com', access: true });
    let downloadDir;
    try {
        await s.goto('/appeal-packet.html?property=7');
        await s.page.waitForURL('**/appeal-packet*id=free_fixture');
        await s.page.getByRole('heading', { name: 'Submit it yourself · Free' }).waitFor();
        assert.equal(s.store.starts.length, 1);
        assert.equal(s.store.starts[0].propertyId, 7);
        assert.equal(s.store.starts[0].taxYear, new Date().getFullYear());
        assert.equal(await s.page.locator('[data-action="purchase"]').getByRole('heading').textContent(), 'Optional DocuSign + print and mail · $49');
        const downloading = s.page.waitForEvent('download');
        await s.page.getByRole('button', { name: 'Download Submission', exact: true }).click();
        const download = await downloading;
        assert.equal(download.suggestedFilename(), 'test-appeal.pdf');
        downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cookcounty-download-'));
        const target = path.join(downloadDir, download.suggestedFilename());
        await download.saveAs(target);
        assert.ok(fs.readFileSync(target, 'utf8').startsWith('%PDF-'));
        assert.equal(s.store.signatureCalls, 0);
    } finally {
        if (downloadDir) fs.rmSync(downloadDir, { recursive: true });
        await s.close();
    }
});

test('saved-property action preserves the signed-in session through delayed restoration', async () => {
    const s = await scenario({ email: 'tester@example.com', access: true, restoreDelay: 400 });
    try {
        await s.goto('/login.html');
        const prepare = s.page.locator('#address-list').getByRole('link', { name: 'Prepare my appeal', exact: true });
        await prepare.waitFor();
        await prepare.click();
        await s.page.waitForURL('**/appeal-packet*id=free_fixture');
        await s.page.getByRole('heading', { name: 'Submit it yourself · Free' }).waitFor();
        assert.equal(await s.page.locator('#packet-session').textContent(), 'Signed in as tester@example.com');
        assert.equal(await s.page.locator('#packet-sign-in').isVisible(), false);
        assert.equal(s.store.starts.length, 1);
        assert.equal(await s.page.evaluate(() => sessionStorage.getItem('regression-sign-outs')), null);
    } finally { await s.close(); }
});

test('appeal startup shows loading until session restoration completes', async () => {
    const s = await scenario({ email: 'tester@example.com', access: true, restoreDelay: 1200 });
    try {
        await s.goto('/appeal-packet.html');
        assert.equal(await s.page.locator('#packet-session').textContent(), 'Restoring your session…');
        assert.equal(await s.page.locator('#packet-sign-in').isVisible(), false);
        assert.equal(await s.page.locator('#packet-orders').isVisible(), false);
        await s.page.waitForFunction(() => document.getElementById('packet-session').textContent.includes('tester@example.com'));
        await s.page.locator('#packet-property option[value="7"]').waitFor({ state: 'attached' });
        assert.equal(await s.page.locator('#packet-property').isEnabled(), true);
    } finally { await s.close(); }
});

test('stale email verification refreshes without signing the account out', async () => {
    const s = await scenario({ email: 'tester@example.com', verified: false, refreshVerified: true, access: true });
    try {
        await s.goto('/appeal-packet.html?property=7');
        await s.page.waitForURL('**/appeal-packet*id=free_fixture');
        await s.page.getByRole('heading', { name: 'Submit it yourself · Free' }).waitFor();
        assert.equal(await s.page.locator('#packet-sign-in').isVisible(), false);
        assert.equal(await s.page.evaluate(() => sessionStorage.getItem('regression-sign-outs')), null);
    } finally { await s.close(); }
});

test('unverified account remains signed in while protected appeal actions stay unavailable', async () => {
    const s = await scenario({ email: 'tester@example.com', verified: false, access: true });
    try {
        await s.goto('/appeal-packet.html?property=7');
        await s.page.waitForFunction(() => document.getElementById('packet-message').textContent.includes('Verify your email'));
        assert.equal(await s.page.locator('#packet-orders').isVisible(), false);
        assert.equal(await s.page.locator('#packet-sign-in').textContent(), 'Verify email');
        assert.equal(s.store.starts.length, 0);
        assert.equal(await s.page.evaluate(() => sessionStorage.getItem('regression-sign-outs')), null);
        const result = await s.page.evaluate(async () => {
            const { authFetch } = await import('/auth-client.js?v=20261103-checkout-download');
            try { await authFetch('/api/addresses'); return 'unexpected access'; } catch (error) { return error.message; }
        });
        assert.match(result, /verify your email/i);
        await s.goto('/login.html');
        await s.page.getByRole('heading', { name: 'Email verification required', exact: true }).waitFor();
        assert.equal(await s.page.evaluate(() => sessionStorage.getItem('regression-sign-outs')), null);
    } finally { await s.close(); }
});

test('landing-page packet action starts an appeal even when the advisory access service fails', async () => {
    const s = await scenario({ email: 'vuchicago@gmail.com', access: true });
    try {
        s.store.accessFails = true;
        await s.goto('/index.html');
        await s.page.getByRole('link', {name:'Start or manage my packet',exact:true}).click();
        await s.page.locator('#packet-property option[value="7"]').waitFor({state:'attached'});
        await s.page.locator('#packet-property').selectOption('7');
        await s.page.locator('#packet-start').click();
        await s.page.getByRole('heading',{name:'Submit it yourself · Free'}).waitFor();
        assert.equal(await s.page.locator('#packet-session').textContent(), 'Signed in as vuchicago@gmail.com');
        assert.equal(await s.page.locator('#packet-sign-in').isVisible(), false);
        assert.equal(await s.page.locator('#packet-waitlist').isVisible(), false);
        assert.equal(s.store.starts.length,1);
        assert.equal(await s.page.evaluate(() => sessionStorage.getItem('regression-sign-outs')), null);
    } finally { await s.close(); }
});

test('packet picker and start do not wait for a pending advisory access request', async () => {
    const s = await scenario({email:'tester@example.com',access:true,holdAccess:true});
    try {
        await s.goto('/appeal-packet.html');
        await s.page.locator('#packet-property option[value="7"]').waitFor({state:'attached'});
        await s.page.locator('#packet-property').selectOption('7');
        await s.page.locator('#packet-start').click();
        await s.page.getByRole('heading',{name:'Submit it yourself · Free'}).waitFor();
        s.store.releaseAccess();
        await s.page.waitForTimeout(100);
        assert.equal(await s.page.locator('#packet-workspace').isVisible(),true);
        assert.equal(s.store.starts.length,1);
    } finally { await s.close(); }
});

test('failed advisory access cannot bypass the server invitation requirement', async () => {
    const s = await scenario({email:'member@example.com'});
    try {
        s.store.accessFails=true;
        await s.goto('/appeal-packet.html');
        await s.page.locator('#packet-property option[value="7"]').waitFor({state:'attached'});
        await s.page.locator('#packet-property').selectOption('7');
        await s.page.locator('#packet-start').click();
        await s.page.locator('#packet-waitlist').waitFor();
        assert.equal(await s.page.locator('#packet-workspace').isVisible(),false);
        assert.equal(s.store.starts.length,0);
        assert.equal(await s.page.locator('#packet-sign-in').isVisible(),false);
    } finally { await s.close(); }
});

test('existing packets can be listed and opened while the access service fails', async () => {
    const s = await scenario({email:'tester@example.com',access:true,holdProperties:true,history:[{id:'free_fixture',propertyAddress:property.address}]});
    try {
        s.store.accessFails=true;
        await s.goto('/appeal-packet.html');
        await s.page.locator('#packet-existing').getByRole('link',{name:/open packet/}).click();
        await s.page.getByRole('heading',{name:'Submit it yourself · Free'}).waitFor();
        assert.equal(s.store.starts.length,0);
        assert.equal(await s.page.locator('#packet-sign-in').isVisible(),false);
    } finally { await s.close(); }
});

test('a rejected cached token refreshes once and retries the same packet start before any mutation', async () => {
    const s = await scenario({email:'tester@example.com',access:true,rejectCachedToken:true});
    try {
        await s.goto('/appeal-packet.html?property=7');
        await s.page.getByRole('heading',{name:'Submit it yourself · Free'}).waitFor();
        const attempts=s.store.authAttempts.filter(row=>row.path==='/api/packet-start');
        assert.equal(attempts.length,2);
        assert.equal(attempts[0].token,'Bearer regression-token');
        assert.equal(attempts[1].token,'Bearer regression-fresh-token');
        assert.equal(attempts[0].method,'POST');
        assert.equal(attempts[0].body,attempts[1].body);
        assert.equal(s.store.starts.length,1);
        assert.equal(await s.page.evaluate(()=>window.__regressionTokenRefreshes),1);
        assert.equal(await s.page.evaluate(()=>sessionStorage.getItem('regression-sign-outs')),null);
    } finally { await s.close(); }
});

test('persistent unauthorized responses stop after one token retry without signing out', async () => {
    const s = await scenario({email:'tester@example.com',access:true,alwaysUnauthorized:true});
    try {
        await s.goto('/appeal-packet.html?property=7');
        await s.page.locator('#packet-retry').waitFor();
        assert.equal(s.store.authAttempts.filter(row=>row.path==='/api/packet-start').length,2);
        assert.equal(s.store.starts.length,0);
        assert.equal(await s.page.locator('#packet-sign-in').isVisible(),false);
        assert.equal(await s.page.evaluate(()=>sessionStorage.getItem('regression-sign-outs')),null);
    } finally { await s.close(); }
});

test('sign-in returns to the selected property and starts the appeal once', async () => {
    const s = await scenario({ email: 'tester@example.com', startSignedOut: true, access: true });
    try {
        await s.goto('/appeal-packet.html?property=7');
        await s.page.locator('#packet-sign-in').waitFor();
        const returnUrl = new URL(await s.page.locator('#packet-sign-in').getAttribute('href'), base).searchParams.get('next');
        assert.match(returnUrl, /^\/appeal-packet(?:\.html)?\?property=7$/);
        await s.page.locator('#packet-sign-in').click();
        await s.page.locator('#auth-form #email').fill('tester@example.com');
        await s.page.locator('#auth-form #password').fill('synthetic-test-password');
        assert.equal(await s.page.locator('#forgot-password-btn').textContent(), 'Forgot password?');
        await s.page.locator('#auth-form').getByRole('button', { name: 'Sign In', exact: true }).click();
        await s.page.waitForURL('**/appeal-packet*id=free_fixture');
        await s.page.getByRole('heading', { name: 'Submit it yourself · Free' }).waitFor();
        assert.equal(s.store.starts.length, 1);
        assert.equal(s.store.starts[0].propertyId, 7);
    } finally { await s.close(); }
});

test('sign-in ignores return URLs outside the site', async () => {
    const s = await scenario({ email: 'tester@example.com', access: true });
    try {
        await s.goto('/login.html?next=https%3A%2F%2Fexample.invalid%2F');
        await s.page.locator('#address-list').getByRole('link', { name: 'Prepare my appeal', exact: true }).waitFor();
        assert.equal(new URL(s.page.url()).origin, base.origin);
    } finally { await s.close(); }
});

test('existing packet opens while property-list and history services are failing', async () => {
    const s = await scenario({ email: 'tester@example.com', access: true });
    try {
        s.store.addressesFailsLeft = 10;
        s.store.historyFails = true;
        await s.goto('/appeal-packet.html?id=free_fixture');
        await s.page.getByRole('heading', { name: 'Submit it yourself · Free' }).waitFor();
        assert.deepEqual(s.store.requests, ['/api/packet?id=free_fixture']);
    } finally { await s.close(); }
});

test('selected-property appeal opens directly without another property list or page reload', async () => {
    const s = await scenario({ email: 'tester@example.com', access: true });
    try {
        s.store.addressesFailsLeft = 10;
        s.store.historyFails = true;
        await s.goto('/appeal-packet.html?property=7');
        await s.page.getByRole('heading', { name: 'Submit it yourself · Free' }).waitFor();
        assert.deepEqual(s.store.requests, ['/api/packet-start', '/api/packet?id=free_fixture']);
        assert.equal(s.store.starts[0].propertyId, 7);
        assert.equal(await s.page.evaluate(() => performance.getEntriesByType('navigation')[0].name.includes('property=7')), true);
    } finally { await s.close(); }
});

test('property picker is usable while appeal history is still pending', async () => {
    const s = await scenario({ email: 'tester@example.com', access: true, holdHistory: true });
    try {
        await s.goto('/appeal-packet.html');
        await s.page.locator('#packet-property option[value="7"]').waitFor({ state: 'attached' });
        assert.equal(await s.page.locator('#packet-start').isDisabled(), true);
        await s.page.locator('#packet-property').selectOption('7');
        await s.page.locator('#packet-start').click();
        await s.page.getByRole('heading', { name: 'Submit it yourself · Free' }).waitFor();
        assert.ok(s.store.requests.includes('/api/addresses?summary=1'));
        assert.ok(!s.store.requests.includes('/api/addresses'));
        assert.equal(s.store.starts.length, 1);
        assert.equal(s.store.historyRequests, 1);
    } finally { await s.close(); }
});

test('property-list failure can be retried without signing out', async () => {
    const s = await scenario({ email: 'tester@example.com', access: true });
    try {
        s.store.addressesFailsLeft = 1;
        await s.goto('/appeal-packet.html');
        await s.page.getByRole('button', { name: 'Try again', exact: true }).waitFor();
        assert.match(await s.page.locator('#packet-message').textContent(), /Test property loading failure/);
        await s.page.getByRole('button', { name: 'Try again', exact: true }).click();
        await s.page.locator('#packet-property option[value="7"]').waitFor({ state: 'attached' });
        assert.equal(await s.page.locator('#packet-property').isEnabled(), true);
        assert.equal(await s.page.locator('#packet-sign-in').isVisible(), false);
        assert.equal(await s.page.evaluate(() => sessionStorage.getItem('regression-sign-outs')), null);
    } finally { await s.close(); }
});

test('appeal-start retry retains the chosen property and assessment year', async () => {
    const s = await scenario({ email: 'tester@example.com', access: true });
    try {
        s.store.startFailsLeft = 1;
        await s.goto('/appeal-packet.html');
        await s.page.locator('#packet-property').selectOption('7');
        await s.page.locator('#packet-year').fill('2025');
        await s.page.locator('#packet-start').click();
        await s.page.getByRole('button', { name: 'Try again', exact: true }).waitFor();
        assert.equal(await s.page.locator('#packet-property').inputValue(), '7');
        assert.equal(await s.page.locator('#packet-year').inputValue(), '2025');
        await s.page.getByRole('button', { name: 'Try again', exact: true }).click();
        await s.page.getByRole('heading', { name: 'Submit it yourself · Free' }).waitFor();
        assert.deepEqual(s.store.starts, [{ propertyId: 7, taxYear: 2025 }, { propertyId: 7, taxYear: 2025 }]);
        assert.equal(await s.page.locator('#packet-sign-in').isVisible(), false);
    } finally { await s.close(); }
});

test('packet-load retry resumes the created workspace without starting another one', async () => {
    const s = await scenario({ email: 'tester@example.com', access: true });
    try {
        s.store.packetFailsLeft = 1;
        await s.goto('/appeal-packet.html?property=7');
        await s.page.getByRole('button', { name: 'Try again', exact: true }).waitFor();
        assert.equal(new URL(s.page.url()).searchParams.get('id'), 'free_fixture');
        await s.page.getByRole('button', { name: 'Try again', exact: true }).click();
        await s.page.getByRole('heading', { name: 'Submit it yourself · Free' }).waitFor();
        assert.equal(s.store.starts.length, 1);
        assert.equal(s.store.requests.filter(url => url === '/api/packet?id=free_fixture').length, 2);
    } finally { await s.close(); }
});

test('property selection stays locked while the appeal start request is pending', async () => {
    const s = await scenario({ email: 'tester@example.com', access: true });
    let release, observed;
    const gate = new Promise(resolve => { release = resolve; });
    const requested = new Promise(resolve => { observed = resolve; });
    try {
        await s.page.route('**/api/packet-start', async route => { observed(); await gate; await route.fallback(); });
        await s.goto('/appeal-packet.html');
        await s.page.locator('#packet-property').selectOption('7');
        await s.page.locator('#packet-start').click();
        await requested;
        assert.equal(await s.page.locator('#packet-property').isDisabled(), true);
        assert.equal(await s.page.locator('#packet-start').isDisabled(), true);
        release();
        await s.page.getByRole('heading', { name: 'Submit it yourself · Free' }).waitFor();
        assert.equal(s.store.starts.length, 1);
    } finally { release(); await s.close(); }
});

test('account properties and live address suggestions do not wait for role or appeal-access checks', async () => {
    const s = await scenario({ email:'tester@example.com', access:true, holdRoles:true, holdAccess:true });
    try {
        await s.goto('/login.html');
        await s.page.locator('#address-list').getByText(property.address,{exact:true}).waitFor();
        assert.equal(await s.page.locator('#new-property-address').isEnabled(), true);
        await s.page.locator('#new-property-address').fill('125 TEST');
        await s.page.getByRole('option',{name:/125 TEST AVE SKOKIE/}).waitFor();
        assert.deepEqual(s.store.lookups,['125 TEST']);
        assert.equal(s.store.addressPosts.length,0);
    } finally { await s.close(); }
});

test('adding a property survives an older pending list response, reload, and appeal preparation', async () => {
    const s = await scenario({ email:'tester@example.com', access:true, holdProperties:true });
    try {
        await s.goto('/login.html');
        await s.page.locator('#user-dashboard').waitFor();
        await s.page.locator('#new-property-address').fill('125 TEST');
        await s.page.getByRole('option',{name:/125 TEST AVE SKOKIE/}).click();
        await s.page.locator('#add-address-btn').click();
        await s.page.locator('#address-list').getByText(suggestedProperty.address,{exact:true}).waitFor();
        assert.deepEqual(s.store.addressPosts,[{address:suggestedProperty.address,propertyKey:suggestedProperty.propertyKey}]);
        assert.equal(s.store.lookups.length,1,'Selecting a result must not reopen lookup on focus');
        s.store.releaseProperties();
        await s.page.locator('#address-list').getByText(property.address,{exact:true}).waitFor();
        await s.page.locator('#address-list').getByText(suggestedProperty.address,{exact:true}).waitFor();
        assert.ok(s.store.summaryRequests>=2,'A stale list must be refreshed after a concurrent property save');
        await s.page.evaluate(()=>{for(const key of Object.keys(localStorage)) if(key.startsWith('ctc-dashboard:')) localStorage.removeItem(key);});
        await s.page.reload({waitUntil:'load'});
        const added = s.page.locator('.address-item').filter({hasText:suggestedProperty.address});
        await added.getByRole('link',{name:'Prepare my appeal',exact:true}).click();
        await s.page.getByRole('heading',{name:suggestedProperty.address,exact:true}).waitFor();
        assert.equal(s.store.starts.at(-1).propertyId,8,'Appeal must use the saved account property ID, not the public lookup ID');
        assert.equal(s.store.addressPosts.length,1);
    } finally { await s.close(); }
});

test('Enter selects an address suggestion before a second Enter adds the property', async () => {
    const s = await scenario({email:'tester@example.com',access:true});
    try {
        await s.goto('/login.html');
        await s.page.locator('#new-property-address').fill('125 TEST');
        await s.page.getByRole('option',{name:/125 TEST AVE SKOKIE/}).waitFor();
        await s.page.locator('#new-property-address').press('Enter');
        assert.equal(await s.page.locator('#new-property-address').inputValue(),suggestedProperty.address);
        assert.equal(await s.page.locator('#add-address-btn').isEnabled(),true);
        assert.equal(s.store.addressPosts.length,0);
        await s.page.locator('#new-property-address').press('Enter');
        await s.page.locator('#address-list').getByText(suggestedProperty.address,{exact:true}).waitFor();
        assert.equal(s.store.addressPosts.length,1);
        assert.equal(await s.page.locator('#property-address-suggestions').isVisible(),false);
    } finally { await s.close(); }
});

test('account property failures show retry instead of claiming there are no saved addresses', async () => {
    const s = await scenario({email:'tester@example.com',access:true});
    try {
        s.store.addressesFailsLeft=1;
        await s.goto('/login.html');
        await s.page.getByRole('button',{name:'Retry properties',exact:true}).waitFor();
        assert.match(await s.page.locator('#property-list-status').textContent(),/Could not load/);
        assert.equal(await s.page.getByText('No addresses added yet.',{exact:true}).count(),0);
        await s.page.getByRole('button',{name:'Retry properties',exact:true}).click();
        await s.page.locator('#address-list').getByText(property.address,{exact:true}).waitFor();
        assert.equal(await s.page.locator('#auth-container').isVisible(),false);
    } finally { await s.close(); }
});

test('account loads property details only when that saved property is selected', async () => {
    const s = await scenario({email:'tester@example.com',access:true});
    try {
        await s.goto('/login.html');
        const title = s.page.locator('#address-list').getByText(property.address,{exact:true});
        await title.waitFor();
        assert.equal(s.store.requests.some(url=>url.includes('propertyId=')),false);
        await title.click();
        await s.page.locator('#selected-property-details').getByText('Assessed Value',{exact:true}).waitFor();
        assert.ok(s.store.requests.includes('/api/addresses?propertyId=7'));
        assert.ok(!s.store.requests.includes('/api/addresses'));
    } finally { await s.close(); }
});

test('property with an existing appeal can be deleted while its packet remains available',async()=>{
    const history=[{id:'free_fixture',propertyKey:property.property_key,propertyAddress:property.address,paymentStatus:'free',appealStatus:'Pending'}];
    const s=await scenario({email:'tester@example.com',access:true,history});
    try {
        await s.goto('/login.html');
        await s.page.locator('#address-list').getByText('1 appeal(s)',{exact:true}).waitFor();
        const remove=s.page.getByRole('button',{name:`Delete ${property.address}`,exact:true});
        await remove.waitFor();
        s.page.once('dialog',dialog=>dialog.accept());
        await remove.click();
        await s.page.locator('#address-list').getByText('No addresses added yet.',{exact:true}).waitFor();
        assert.equal(s.store.addressDeletes.length,1);
        assert.equal(s.store.addressDeletes[0].propertyId,7);
        assert.equal(s.store.history.length,1);
        await s.page.reload();
        await s.page.locator('#address-list').getByText('No addresses added yet.',{exact:true}).waitFor();
        await s.goto('/appeal-packet.html?id=free_fixture');
        await s.page.getByRole('heading',{name:'Submit it yourself · Free'}).waitFor();
    } finally {await s.close();}
});

test('canceling property deletion leaves the saved property untouched',async()=>{
    const s=await scenario({email:'tester@example.com',access:true});
    try {
        await s.goto('/login.html');
        const remove=s.page.getByRole('button',{name:`Delete ${property.address}`,exact:true});
        await remove.waitFor();
        s.page.once('dialog',dialog=>dialog.dismiss());
        await remove.click();
        assert.equal(s.store.addressDeletes.length,0);
        assert.equal(await remove.isEnabled(),true);
    } finally {await s.close();}
});

test('failed property deletion keeps the address and allows retry',async()=>{
    const s=await scenario({email:'tester@example.com',access:true});
    try {
        s.store.deleteFails=true;
        await s.goto('/login.html');
        const remove=s.page.getByRole('button',{name:`Delete ${property.address}`,exact:true});
        s.page.on('dialog',dialog=>dialog.accept());
        await remove.click();
        await s.page.waitForFunction(()=>!document.querySelector('.delete-address-btn').disabled);
        assert.equal(s.store.addresses.length,1);
        s.store.deleteFails=false;
        await remove.click();
        await s.page.locator('#address-list').getByText('No addresses added yet.',{exact:true}).waitFor();
        assert.equal(s.store.addressDeletes.length,2);
    } finally {await s.close();}
});

test('guided appeal cards save the necessary answers without a deadline or calendar check',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'intake',propertyDetails:{classCode:'203',townshipName:'Niles',taxableValue:30000},comparables:questionComparisons});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');
        assert.equal(await s.page.locator('form[data-action="intake"]').count(),0);
        const dialog=await walkAppealCards(s);
        assert.equal(await dialog.locator('[name="filingDeadline"]').count(),0);
        assert.equal(s.store.intakes.length,1);
        assert.equal(s.store.intakes[0].requestedMarketValue,200000);
        assert.equal(s.store.intakes[0].singleFamilyScope,true);
        assert.equal(s.store.intakes[0].noExistingAppeal,true);
        assert.equal('filingDeadline' in s.store.intakes[0],false);
    } finally {await s.close();}
});

for (const status of ['upcoming','open','closed','unannounced']) {
    test(`signed print-and-mail packet shows its calendar hold and dispatch control: ${status}`,async()=>{
        const s=await scenario({email:'admin@example.com',role:'admin',access:true,packetStatus:'signed',mailingConsent:true,fulfillmentPaid:true,signature:{environment:'production',status:'completed'},mailingWindow:{status,opensOn:status==='unannounced'?null:'2026-10-20',closesOn:status==='unannounced'?null:'2026-12-03'}});
        try {
            await s.goto('/appeal-packet.html?id=free_fixture');
            await s.page.locator('#packet-mailing-queue').waitFor();
            assert.equal(await s.page.locator('form[data-action="mail"]').count(),status==='open'?1:0);
            const title={upcoming:'Waiting for the appeal window to open',open:'Ready for print and mail',closed:'Appeal window closed',unannounced:'Waiting for the township appeal calendar'}[status];
            await s.page.getByRole('heading',{name:title,exact:true}).waitFor();
            assert.equal(await s.page.locator('form[data-action="mail"] [name="filingDeadline"]').count(),0);
        } finally {await s.close();}
    });
}

test('cards prefill comparisons and ask only for missing contact details before free PDF download',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'intake',propertyDetails:{classCode:'203',townshipName:'Niles',taxableValue:30000},officialForms:[{kind:'application',title:'Official Assessor application',ready:false,missingValues:[{source:'mailingCity',label:'Mailing city'},{source:'mailingState',label:'Mailing state'},{source:'mailingZip',label:'Mailing ZIP'}]}],comparables:questionComparisons});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');
        const dialog=await walkAppealCards(s,{mailing:{mailingCity:'Chicago',mailingState:'IL',mailingZip:'60601'}});
        assert.equal(s.store.intakes[0].mailingCity,'Chicago');
        assert.equal(s.store.intakes[0].selectedComparables.length,5);
        assert.equal(await dialog.locator('[name="documentsReviewed"]').count(),0);
        const downloading=s.page.waitForEvent('download');
        await dialog.getByRole('button',{name:'Download PDF',exact:true}).click();
        await downloading;
        assert.equal(s.store.checkoutRequests.length,0);assert.equal(s.store.signatureCalls,0);
    } finally {await s.close();}
});

test('an existing out-of-scope packet keeps downloads while new preparation and purchase stay unavailable',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'intake',propertyDetails:{classCode:'299'}});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');
        await s.page.getByRole('heading',{name:'Single-family homes only',exact:true}).waitFor();
        assert.equal(await s.page.locator('form[data-action="intake"]').count(),0);
        assert.equal(await s.page.locator('form[data-action="generate"]').count(),0);
        assert.equal(await s.page.locator('form[data-action="purchase"]').count(),0);
        assert.equal(await s.page.locator('[data-document="prepared"]').count(),1);
    }finally{await s.close();}
});

test('administrator imports a reusable template once and other accounts cannot access setup',async()=>{
    const s=await scenario({email:'admin@example.com',access:true,role:'admin'});
    try {
        await s.goto('/official-forms.html');
        const form=s.page.locator('#official-form-setup');await form.waitFor();
        await form.locator('[name="file"]').setInputFiles({name:'official-test-fixture.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nFixture only')});
        await s.page.getByRole('button',{name:'Inspect PDF fields',exact:true}).click();
        await s.page.waitForFunction(()=>document.getElementById('official-field-list').textContent.includes('Owner Signature'));
        assert.ok((await form.locator('[name="mapping"]').inputValue()).includes('Owner signs after review'));
        await form.locator('[name="mapping"]').fill(JSON.stringify({ownerName:{source:'ownerName',required:true},'Owner Signature':{skip:true,reason:'Owner signs after review'}}));
        for(const box of await form.locator('input[type="checkbox"][required]').all())await box.check();
        await form.getByRole('button',{name:'Publish reviewed template',exact:true}).click();
        await s.page.waitForFunction(()=>document.getElementById('form-status').textContent.startsWith('Published reviewed template'));
        assert.equal(s.store.publishedForms.length,1);
        assert.equal(s.store.publishedForms[0].signaturesBlank,true);
    }finally{await s.close();}
    const owner=await scenario({email:'tester@example.com',access:true});
    try {
        await owner.goto('/official-forms.html');
        await owner.page.waitForFunction(()=>document.getElementById('form-status').textContent.includes('Admin only'));
        assert.equal(await owner.page.locator('#official-form-setup').isVisible(),false);
        assert.equal(owner.store.publishedForms.length,0);
    }finally{await owner.close();}
});

test('free preparation copy can be downloaded before official templates or payment are available',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'intake',documents:[],propertyDetails:{classCode:'203'},officialForms:[{kind:'application',ready:false,missingValues:[]}]});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');
        const downloading=s.page.waitForEvent('download');
        await s.page.getByRole('button',{name:'Download free preparation copy',exact:true}).click();
        const file=await downloading;assert.equal(file.suggestedFilename(),'assessor-2026-preparation-copy.pdf');
        assert.ok(s.store.requests.includes('/api/packet?id=free_fixture&download=preparation'));
        assert.equal(s.store.checkoutRequests.length,0);assert.equal(s.store.signatureCalls,0);
        assert.equal(s.store.packetStatus,'intake');
    }finally{await s.close();}
});

test('temporary free-download failure shows the reason and permits retry without payment',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'intake',documents:[]});
    try {
        s.store.preparationDownloadFails=true;
        await s.goto('/appeal-packet.html?id=free_fixture');
        const button=s.page.getByRole('button',{name:'Download free preparation copy',exact:true});await button.click();
        await s.page.waitForFunction(()=>document.getElementById('packet-message').textContent.includes('Temporary packet download failure'));
        assert.equal(await button.isEnabled(),true);
        s.store.preparationDownloadFails=false;
        const downloading=s.page.waitForEvent('download');await button.click();await downloading;
        assert.equal(s.store.checkoutRequests.length,0);
    }finally{await s.close();}
});

test('administrator can test the existing live Stripe checkout without treating it as fulfillment',async()=>{
    const s=await scenario({email:'admin@example.com',role:'admin',access:true,packetStatus:'intake',documents:[],checkout:{testing:true,enabled:true,mode:'live'}});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');
        const form=s.page.locator('form[data-action="payment_test"]');await form.waitFor();
        assert.ok((await form.textContent()).includes('charges the card $49'));
        await form.locator('[name="testPaymentAccepted"]').check();
        await form.getByRole('button',{name:'Continue to Stripe payment test',exact:true}).click();
        await s.page.waitForURL(url=>/^\/return(?:\.html)?$/.test(url.pathname)&&url.searchParams.get('session_id')==='cs_fixture');
        await s.page.getByText('Your administrator Stripe payment test was received. This does not order signing or mailing.',{exact:true}).waitFor();
        assert.equal(s.store.checkoutRequests.length,1);
        assert.equal(s.store.checkoutRequests[0].paymentTest,true);
        assert.equal(s.store.checkoutRequests[0].fulfillmentAccepted,true);
        assert.equal(s.store.signatureCalls,0);
        assert.equal(s.store.packetStatus,'intake');
    }finally{await s.close();}
});

const questionComparisons=[1,2,3,4,5].map(n=>({pin:String(n).padStart(14,'0'),address:`${n} Comparison Ave`,homeSize:1400,yearBuilt:1965,taxableValue:20000+n}));
async function walkAppealCards(s,options={}) {
    const page=s.page,dialog=page.locator('dialog.appeal-question-dialog');
    if(!await dialog.isVisible())await page.getByRole('button',{name:/^(Prepare my appeal|Continue)$/}).click();
    const at=title=>dialog.getByRole('heading',{name:title,exact:true}).waitFor();
    const choose=async(key,value)=>{await dialog.locator(`[data-choice="${key}"][data-value="${value}"]`).click();};
    const next=async()=>{await dialog.getByRole('button',{name:'Continue',exact:true}).click();};
    await at('Is this the home you want to appeal?');await choose('singleFamilyScope',true);
    await at('Is the property titled in your individual name?');await choose('individualOwner',true);
    await at('Is anyone already handling this appeal?');await choose('noExistingAppeal',true);
    await at('Do you live in this home?');await choose('ownResidence',!options.rental);
    if(options.rental) {
        await at('Dated front photo of your property');
        assert.equal(s.store.intakes.length,0);
        if(options.uploadPhoto) {
            await dialog.locator('[name="file"]').setInputFiles({name:'front-photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yMJcAAAAASUVORK5CYII=','base64')});
            await dialog.locator('[name="photoDate"]').fill('2026-01-01');await dialog.getByRole('button',{name:'Save and continue',exact:true}).click();
        }else await dialog.getByRole('button',{name:'Skip for now',exact:true}).click();
    }
    await at('How should the Assessor contact you?');if(options.expectedOwner)assert.equal(await dialog.locator('[name="ownerName"]').inputValue(),options.expectedOwner);await dialog.locator('[name="ownerName"]').fill(options.ownerName || 'Test Owner');await dialog.locator('[name="ownerPhone"]').fill('3125550100');await next();
    await at('What is your mailing address?');await dialog.locator('[name="mailingAddress"]').fill('99 Owner St');
    for(const [name,value] of Object.entries(options.mailing || {}))await dialog.locator(`[name="${name}"]`).fill(value);
    await next();
    await at('Why are you appealing?');await choose('reason',options.reason || 'uniformity');
    await at('What market value are you requesting?');if(options.expectedRequestedValue)assert.equal(await dialog.locator('[name="requestedMarketValue"]').inputValue(),options.expectedRequestedValue);await dialog.locator('[name="requestedMarketValue"]').fill(options.requestedValue || '200000');await next();
    if(!options.reason || options.reason==='uniformity') {await at('Review your suggested comparisons');assert.equal(await dialog.locator('[name="selectedComparables"]:checked').count(),5);await next();}
    if(options.reason==='characteristics') {await at('What needs to be corrected?');await dialog.locator('[name="explanation"]').fill('The county building area is incorrect. See the measured plan.');}
    else {await at('What would you like the Assessor to know?');if(options.reason==='overvaluation')await dialog.locator('[name="explanation"]').fill('The attached market evidence supports my requested value.');else assert.match(await dialog.locator('[name="explanation"]').inputValue(),/request review/);}
    await next();
    await at('Does a recent purchase apply?');await choose('recentSale',Boolean(options.recentSale));
    if(options.recentSale) {await at('Tell us about the purchase');await dialog.locator('[name="purchaseDate"]').fill('2025-01-10');await dialog.locator('[name="purchasePrice"]').fill('200000');await dialog.locator('[name="sellerName"]').fill('Test Seller');await dialog.locator('[name="saleRelationship"]').fill('None');await next();}
    await at('Do you have an existing appraisal to disclose?');await choose('appraisal',false);
    await at('Does your argument rely on damage or condition?');await choose('damage',false);
    await at('Now add only the evidence that applies');await next();
    await page.waitForFunction(()=>document.querySelector('dialog.appeal-question-dialog #appeal-question-title')?.textContent==='Your packet is ready to review'||Boolean(document.querySelector('dialog.appeal-question-dialog #question-skip')));
    for(let n=0;n<5;n++) {
        if(await dialog.getByRole('heading',{name:'Your packet is ready to review',exact:true}).isVisible())break;
        const skip=dialog.getByRole('button',{name:'Skip for now',exact:true});
        await skip.waitFor();const oldTitle=await dialog.locator('#appeal-question-title').textContent();await skip.click();await page.waitForFunction(previous=>document.querySelector('dialog.appeal-question-dialog #appeal-question-title')?.textContent!==previous,oldTitle);
    }
    await at('Your packet is ready to review');return dialog;
}

test('question cards resume saved progress and preserve contact answers after reload',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'intake',questionnaire:{step:'contact',answers:{singleFamilyScope:true,recordsConfirmed:true,individualOwner:true,noExistingAppeal:true,ownResidence:false,ownerName:'Saved Owner',ownerPhone:'3125550100'}}});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');
        await s.page.getByRole('button',{name:'Continue',exact:true}).click();
        let dialog=s.page.locator('dialog.appeal-question-dialog');
        await dialog.getByRole('heading',{name:'How should the Assessor contact you?',exact:true}).waitFor();
        assert.equal(await dialog.locator('[name="ownerName"]').inputValue(),'Saved Owner');
        await dialog.locator('[name="ownerName"]').fill('Updated Owner');
        await dialog.getByRole('button',{name:'Continue',exact:true}).click();
        await dialog.getByRole('heading',{name:'What is your mailing address?',exact:true}).waitFor();
        await s.page.reload();await s.page.getByRole('button',{name:'Continue',exact:true}).click();
        dialog=s.page.locator('dialog.appeal-question-dialog');await dialog.getByRole('heading',{name:'What is your mailing address?',exact:true}).waitFor();
        await dialog.getByRole('button',{name:'Back',exact:true}).click();
        await dialog.getByRole('heading',{name:'How should the Assessor contact you?',exact:true}).waitFor();
        assert.equal(await dialog.locator('[name="ownerName"]').inputValue(),'Updated Owner');
        assert.equal(s.store.intakes.length,0);
    }finally{await s.close();}
});

test('cards branch into purchase and rental evidence without requiring unrelated documents',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'intake',propertyDetails:{classCode:'203',townshipName:'Niles',taxableValue:30000},comparables:questionComparisons});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');
        await walkAppealCards(s,{rental:true,recentSale:true});
        assert.equal(s.store.intakes[0].ownResidence,false);
        assert.equal(s.store.intakes[0].purchaseDate,'2025-01-10');
        assert.equal(s.store.intakes[0].appraisal,false);
        assert.equal(s.store.questionnaire.step,'review');
        assert.equal(s.store.signatureCalls,0);
    }finally{await s.close();}
});

test('a property link opens the first question card and mobile controls stay inside the viewport',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'intake',width:390,propertyDetails:{classCode:'203',townshipName:'Niles',taxableValue:30000}});
    try {
        await s.goto('/appeal-packet.html?property=7');
        const dialog=s.page.locator('dialog.appeal-question-dialog');
        await dialog.getByRole('heading',{name:'Is this the home you want to appeal?',exact:true}).waitFor();
        const bounds=await dialog.boundingBox();assert.ok(bounds.x>=0 && bounds.x+bounds.width<=391);
        await s.page.screenshot({path:'/tmp/cookcounty-question-card-mobile.png'});
        await s.page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
        assert.equal(s.store.questionnaire.step,'property');
        assert.equal(await s.page.getByRole('button',{name:'Download free preparation copy',exact:true}).isVisible(),true);
    }finally{await s.close();}
});

test('evidence cards upload only the needed files and return to the PDF review card',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'intake',propertyDetails:{classCode:'203',townshipName:'Niles',taxableValue:30000},comparables:questionComparisons});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');const dialog=await walkAppealCards(s,{rental:true,uploadPhoto:true});
        await dialog.getByRole('button',{name:'Back',exact:true}).click();await dialog.getByRole('heading',{name:'Comparable properties and supporting records',exact:true}).waitFor();
        await dialog.locator('[name="file"]').setInputFiles({name:'comparison-photos.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nTest evidence fixture')});
        await dialog.getByRole('button',{name:'Save and continue',exact:true}).click();
        await dialog.getByRole('heading',{name:'Your packet is ready to review',exact:true}).waitFor();
        const photo=s.store.packetDocuments.find(doc=>doc.category==='photo');assert.equal(photo.photoDate,'2026-01-01');assert.equal(photo.dateStamped,false);
        assert.equal(s.store.packetDocuments.filter(doc=>doc.category==='photo').length,1);
        assert.ok(s.store.packetDocuments.some(doc=>doc.category==='comparisons'));
        assert.equal(s.store.signatureCalls,0);
        await dialog.getByRole('button',{name:'Save and close',exact:true}).click();await dialog.waitFor({state:'hidden'});
        assert.equal(await s.page.evaluate(()=>document.activeElement.id),'open-appeal-questions');
    }finally{await s.close();}
});

test('a failed card save keeps the answer visible and can be retried',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'intake',questionnaire:{step:'contact',answers:{ownerName:'Saved Owner',ownerPhone:'3125550100'}}});
    try {
        s.store.draftFailsLeft=1;
        await s.goto('/appeal-packet.html?id=free_fixture');await s.page.getByRole('button',{name:'Continue',exact:true}).click();
        const dialog=s.page.locator('dialog.appeal-question-dialog');await dialog.getByRole('heading',{name:'How should the Assessor contact you?',exact:true}).waitFor();
        await dialog.locator('[name="ownerName"]').fill('Kept Owner');await dialog.getByRole('button',{name:'Continue',exact:true}).click();
        await dialog.getByRole('alert').getByText(/Temporary answer saving failure/).waitFor();
        assert.equal(await dialog.locator('[name="ownerName"]').inputValue(),'Kept Owner');
        await dialog.getByRole('button',{name:'Continue',exact:true}).click();await dialog.getByRole('heading',{name:'What is your mailing address?',exact:true}).waitFor();
        assert.equal(s.store.questionnaire.answers.ownerName,'Kept Owner');
        assert.equal(s.store.intakes.length,0);
    }finally{await s.close();}
});

test('the final question card builds and downloads the complete packet when its forms and evidence are ready',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'intake',propertyDetails:{classCode:'203',townshipName:'Niles',taxableValue:30000},comparables:questionComparisons,officialForms:[{kind:'application',title:'Official Assessor application',ready:true,missingValues:[]}]});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');const dialog=await walkAppealCards(s);
        assert.equal(await dialog.getByRole('button',{name:'Download PDF',exact:true}).count(),1);
        const downloading=s.page.waitForEvent('download');await dialog.getByRole('button',{name:'Download PDF',exact:true}).click();await downloading;
        await s.page.getByRole('heading',{name:'Review your prepared packet',exact:true}).waitFor();
        assert.equal(s.store.packetGenerated,1);
        assert.ok(s.store.requests.includes('/api/packet?id=free_fixture&document=generated-1'));
        assert.equal(s.store.checkoutRequests.length,0);assert.equal(s.store.signatureCalls,0);
    }finally{await s.close();}
});

test('a completed packet stays downloadable when its first card-flow download fails',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'intake',propertyDetails:{classCode:'203',townshipName:'Niles',taxableValue:30000},comparables:questionComparisons,officialForms:[{kind:'application',title:'Official Assessor application',ready:true,missingValues:[]}]});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');const dialog=await walkAppealCards(s);
        s.store.packetDownloadFails=true;await dialog.getByRole('button',{name:'Download PDF',exact:true}).click();
        await s.page.locator('#packet-message').getByText(/Your PDF is saved.*Temporary packet download failure/).waitFor();
        await dialog.waitFor({state:'hidden'});
        s.store.packetDownloadFails=false;
        const downloading=s.page.waitForEvent('download');await s.page.getByRole('button',{name:'Download Submission',exact:true}).click();await downloading;
        assert.equal(s.store.packetGenerated,1);assert.equal(s.store.checkoutRequests.length,0);assert.equal(s.store.signatureCalls,0);
    }finally{await s.close();}
});

test('comparison cards show only lower assessed values and remove disallowed older selections',async()=>{
    const comparables=[...questionComparisons,{pin:'equal',address:'Equal Value St',taxableValue:30000},{pin:'higher',address:'Higher Value St',taxableValue:40000},{pin:'missing',address:'Missing Value St'}];
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'intake',propertyDetails:{classCode:'203',taxableValue:30000},comparables,questionnaire:{step:'comparisons',answers:{reason:'uniformity',selectedComparables:comparables.map(c=>c.pin)}}});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');await s.page.getByRole('button',{name:'Continue',exact:true}).click();
        const dialog=s.page.locator('dialog.appeal-question-dialog');await dialog.getByRole('heading',{name:'Review your suggested comparisons',exact:true}).waitFor();
        assert.equal(await dialog.locator('[name="selectedComparables"]').count(),5);
        assert.equal(await dialog.locator('[name="selectedComparables"]:checked').count(),5);
        assert.match(await dialog.textContent(),/\$300,000/);assert.match(await dialog.textContent(),/Implied market value \$200,010/);
        assert.doesNotMatch(await dialog.textContent(),/Equal Value St|Higher Value St|Missing Value St/);
        assert.equal(await dialog.getByRole('button',{name:'Show more comparisons',exact:true}).count(),0);
        await dialog.getByRole('button',{name:'Continue',exact:true}).click();await dialog.getByRole('heading',{name:'What would you like the Assessor to know?',exact:true}).waitFor();
        assert.deepEqual(s.store.questionnaire.answers.selectedComparables,questionComparisons.map(c=>c.pin));
    }finally{await s.close();}
});

test('no eligible lower-value comparisons offers an upload without auto-selecting higher values',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'intake',propertyDetails:{classCode:'203',taxableValue:30000},comparables:[{pin:'higher',address:'Higher Value St',taxableValue:40000}],questionnaire:{step:'comparisons',answers:{reason:'uniformity',selectedComparables:['higher']}}});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');await s.page.getByRole('button',{name:'Continue',exact:true}).click();
        const dialog=s.page.locator('dialog.appeal-question-dialog');await dialog.getByText('No comparisons with a lower assessed value are available. You can upload your own comparison exhibit in the evidence cards.',{exact:true}).waitFor();
        assert.equal(await dialog.locator('[name="selectedComparables"]').count(),0);
        await dialog.getByRole('button',{name:'Continue',exact:true}).click();await dialog.getByRole('heading',{name:'What would you like the Assessor to know?',exact:true}).waitFor();
        assert.deepEqual(s.store.questionnaire.answers.selectedComparables,[]);
    }finally{await s.close();}
});

test('top five suggestions display implied market values and require swapping before a sixth selection',async()=>{
    const comparables=[{pin:'higher',address:'Higher Value St',taxableValue:40000},...questionComparisons,{pin:'sixth',address:'Sixth Lower Value St',taxableValue:21000}];
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'intake',propertyDetails:{classCode:'203',taxableValue:30000},comparables,questionnaire:{step:'comparisons',answers:{reason:'uniformity'}}});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');await s.page.getByRole('button',{name:'Continue',exact:true}).click();
        const dialog=s.page.locator('dialog.appeal-question-dialog');await dialog.getByRole('heading',{name:'Review your suggested comparisons',exact:true}).waitFor();
        assert.equal(await dialog.locator('[name="selectedComparables"]:checked').count(),5);
        assert.match(await dialog.textContent(),/Implied market value \$200,010/);assert.doesNotMatch(await dialog.textContent(),/Higher Value St/);
        await dialog.getByRole('button',{name:'Show more comparisons',exact:true}).click();
        const sixth=dialog.locator('[name="selectedComparables"][value="sixth"]');await sixth.click();
        assert.equal(await sixth.isChecked(),false);await dialog.getByRole('alert').getByText(/Choose up to five comparisons/).waitFor();
        await dialog.locator(`[name="selectedComparables"][value="${questionComparisons[0].pin}"]`).uncheck();await sixth.check();
        assert.equal(await dialog.locator('[name="selectedComparables"]:checked').count(),5);
        await dialog.getByRole('button',{name:'Continue',exact:true}).click();await dialog.getByRole('heading',{name:'What would you like the Assessor to know?',exact:true}).waitFor();
        assert.ok(s.store.questionnaire.answers.selectedComparables.includes('sixth'));
    }finally{await s.close();}
});

test('required photo is an early card, needs a capture date, and survives reload before intake',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'intake',questionnaire:{step:'occupancy',answers:{singleFamilyScope:true,recordsConfirmed:true,individualOwner:true,noExistingAppeal:true}}});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');await s.page.getByRole('button',{name:'Continue',exact:true}).click();
        let dialog=s.page.locator('dialog.appeal-question-dialog');await dialog.locator('[data-choice="ownResidence"][data-value="false"]').click();
        await dialog.getByRole('heading',{name:'Dated front photo of your property',exact:true}).waitFor();
        assert.match(await dialog.locator('.question-progress').textContent(),/Card 5 of/);
        await dialog.locator('[name="file"]').setInputFiles({name:'front.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yMJcAAAAASUVORK5CYII=','base64')});
        await dialog.getByRole('button',{name:'Save and continue',exact:true}).click();
        await dialog.getByRole('alert').getByText('Enter the date the photo was taken.',{exact:true}).waitFor();
        assert.equal(s.store.packetDocuments.some(doc=>doc.category==='photo'),false);
        await dialog.locator('[name="photoDate"]').fill('2026-01-01');await dialog.getByRole('button',{name:'Save and continue',exact:true}).click();
        await dialog.getByRole('heading',{name:'How should the Assessor contact you?',exact:true}).waitFor();
        assert.equal(s.store.intakes.length,0);assert.equal(s.store.packetDocuments.find(doc=>doc.category==='photo').photoDate,'2026-01-01');
        await s.page.reload();await s.page.getByRole('button',{name:'Continue',exact:true}).click();
        dialog=s.page.locator('dialog.appeal-question-dialog');await dialog.getByRole('heading',{name:'How should the Assessor contact you?',exact:true}).waitFor();
        assert.equal(s.store.packetDocuments.filter(doc=>doc.category==='photo').length,1);assert.equal(s.store.signatureCalls,0);
    }finally{await s.close();}
});

test('a skipped early photo can be added from review without repeating the questionnaire',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'intake',propertyDetails:{classCode:'203',townshipName:'Niles',taxableValue:30000},comparables:questionComparisons});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');const dialog=await walkAppealCards(s,{rental:true});
        await dialog.getByRole('button',{name:'Add your property photo and date',exact:true}).click();
        await dialog.getByRole('heading',{name:'Dated front photo of your property',exact:true}).waitFor();
        await dialog.locator('[name="file"]').setInputFiles({name:'front.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yMJcAAAAASUVORK5CYII=','base64')});
        await dialog.locator('[name="photoDate"]').fill('2026-01-01');await dialog.getByRole('button',{name:'Save and continue',exact:true}).click();
        await dialog.getByRole('heading',{name:'Your packet is ready to review',exact:true}).waitFor();
        assert.equal(await dialog.getByRole('button',{name:'Add your property photo and date',exact:true}).count(),0);
        assert.equal(s.store.packetDocuments.filter(doc=>doc.category==='photo').length,1);assert.equal(s.store.signatureCalls,0);
    }finally{await s.close();}
});

test('appeal launch card keeps only the title and action, then resumes the saved questions',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'intake'});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');const card=s.page.locator('#appeal-summary');
        await card.getByRole('heading',{name:'Your appeal',exact:true}).waitFor();
        assert.equal(await card.locator('p,.section-badge,.packet-question-illustration').count(),0);
        assert.equal(await card.getByRole('button').count(),1);
        assert.doesNotMatch(await card.textContent(),/One question at a time|Let.s prepare|Progress saves|available signature forms/);
        await card.screenshot({path:'/tmp/cookcounty-appeal-action-draft.png'});
        await card.getByRole('button',{name:'Prepare my appeal',exact:true}).click();
        const dialog=s.page.locator('dialog.appeal-question-dialog');await dialog.getByRole('heading',{name:'Is this the home you want to appeal?',exact:true}).waitFor();
        await s.page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
        await s.page.locator('#appeal-summary').getByRole('button',{name:'Continue',exact:true}).waitFor();
        assert.equal(await s.page.getByRole('button',{name:'Download Submission',exact:true}).count(),0);
    }finally{await s.close();}
});

for(const width of [390,1440])test(`completed submission has adjacent download and edit actions at ${width}px`,async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'review',width});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');const card=s.page.locator('#free-packet-download');
        const download=card.getByRole('button',{name:'Download Submission',exact:true}),edit=card.getByRole('button',{name:'Edit',exact:true});
        await download.waitFor();assert.equal(await edit.isEnabled(),true);
        const left=await download.boundingBox(),right=await edit.boundingBox();assert.ok(right.x>=left.x+left.width);assert.ok(Math.abs(right.y-left.y)<2);
        assert.ok(right.x+right.width<=width);assert.equal(await s.page.locator('form[data-action="revise"]').count(),0);
        await card.screenshot({path:`/tmp/cookcounty-appeal-action-ready-${width}.png`});
        const downloading=s.page.waitForEvent('download');await download.click();await downloading;
        assert.ok(s.store.requests.includes('/api/packet?id=free_fixture&document=prepared'));
    }finally{await s.close();}
});

test('Edit preserves answers and evidence, resets approval and rebuilds the submission with changes',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'intake',propertyDetails:{classCode:'203',townshipName:'Niles',taxableValue:30000},comparables:questionComparisons,officialForms:[{kind:'application',title:'Official Assessor application',ready:true,missingValues:[]}]});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');let dialog=await walkAppealCards(s);
        let downloading=s.page.waitForEvent('download');await dialog.getByRole('button',{name:'Download PDF',exact:true}).click();await downloading;
        await s.page.getByRole('button',{name:'Download Submission',exact:true}).waitFor();
        const previousFiles=s.store.packetDocuments.map(doc=>doc.id);s.store.packetStatus='approved';s.store.approval={version:s.store.packetVersion};
        await s.page.reload();await s.page.getByRole('button',{name:'Edit',exact:true}).click();
        dialog=s.page.locator('dialog.appeal-question-dialog');await dialog.getByRole('heading',{name:'Your packet is ready to review',exact:true}).waitFor();
        assert.equal(s.store.packetStatus,'preparing');assert.equal(s.store.approval,undefined);assert.equal(s.store.reviseRequests,1);
        assert.ok(previousFiles.every(id=>s.store.packetDocuments.some(doc=>doc.id===id)));
        assert.equal(await s.page.locator('.packet-question-launch').getByRole('button',{name:'Download Submission',exact:true}).count(),0);
        await dialog.locator('[data-edit-step="property"]').click();
        dialog=await walkAppealCards(s,{expectedOwner:'Test Owner',expectedRequestedValue:'200000',ownerName:'Updated Owner',requestedValue:'190000'});
        downloading=s.page.waitForEvent('download');await dialog.getByRole('button',{name:'Download PDF',exact:true}).click();await downloading;
        await s.page.getByRole('button',{name:'Download Submission',exact:true}).waitFor();
        assert.equal(s.store.intake.ownerName,'Updated Owner');assert.equal(s.store.intake.requestedMarketValue,190000);assert.equal(s.store.packetGenerated,2);
        downloading=s.page.waitForEvent('download');await s.page.getByRole('button',{name:'Download Submission',exact:true}).click();await downloading;
        assert.ok(s.store.requests.includes('/api/packet?id=free_fixture&document=generated-2'));
        assert.equal(s.store.checkoutRequests.length,0);assert.equal(s.store.signatureCalls,0);
    }finally{await s.close();}
});

test('failed Edit keeps the completed submission downloadable and allows retry',async()=>{
    const s=await scenario({email:'tester@example.com',access:true});
    try {
        s.store.reviseFails=true;await s.goto('/appeal-packet.html?id=free_fixture');
        const edit=s.page.getByRole('button',{name:'Edit',exact:true});await edit.click();
        await s.page.locator('#packet-message').getByText(/Temporary edit failure/).waitFor();
        assert.equal(await edit.isEnabled(),true);assert.equal(s.store.packetStatus,'approved');
        assert.equal(await s.page.getByRole('button',{name:'Download Submission',exact:true}).isVisible(),true);
        s.store.reviseFails=false;await edit.click();
        await s.page.locator('dialog.appeal-question-dialog').getByRole('heading',{name:'Is this the home you want to appeal?',exact:true}).waitFor();
        assert.equal(s.store.reviseRequests,2);
    }finally{await s.close();}
});

test('signed submission downloads the signed PDF and locks editing during fulfillment',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'signed',signedId:'signed-fixture',signature:{status:'completed',environment:'demo'},documents:[{id:'prepared',kind:'packet',version:1,name:'unsigned.pdf'},{id:'signed-fixture',kind:'signed_packet',version:1,name:'signed.pdf'}]});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');
        assert.equal(await s.page.getByRole('button',{name:'Edit',exact:true}).isDisabled(),true);
        const downloading=s.page.waitForEvent('download');await s.page.getByRole('button',{name:'Download Submission',exact:true}).click();await downloading;
        assert.ok(s.store.requests.includes('/api/packet?id=free_fixture&document=signed-fixture'));assert.equal(s.store.reviseRequests,0);
    }finally{await s.close();}
});

for(const email of [undefined,'tester@example.com'])test(`Contact opens its own form from different pages: ${email?'signed in':'anonymous'}`,async()=>{
    const s=await scenario({email,access:Boolean(email)});
    try {
        for(const route of ['/','/property-tax/','/insurance.html']) {
            await s.goto(route);await s.page.locator('.nav-links').getByRole('button',{name:'Company',exact:true}).hover();
            await s.page.locator('.nav-links').getByRole('link',{name:'Contact',exact:true}).click();
            await s.page.waitForURL(url=>/^\/contact(?:\.html)?\/?$/.test(url.pathname));
            await s.page.getByRole('heading',{name:'Contact us',exact:true}).waitFor();
            assert.equal(await s.page.locator('#contact-request').isVisible(),true);
        }
        const form=s.page.locator('#contact-request');
        await form.getByLabel('Full Name',{exact:true}).fill('Test Contact');await form.getByLabel('Email',{exact:true}).fill('contact@example.com');
        await form.getByLabel('Phone #',{exact:true}).fill('7735551234');await form.getByLabel('Address',{exact:true}).fill(property.address);
        await form.getByLabel('Message (optional)',{exact:true}).fill('Please contact me.');
        await form.getByRole('button',{name:'Send message',exact:true}).click();await form.getByRole('status').getByText(/Request received/).waitFor();
        assert.equal(s.store.contacts.length,1);assert.equal(s.store.contacts[0].inquiryType,'contact');assert.equal(s.store.contacts[0].propertyAddress,property.address);
    }finally{await s.close();}
});

test('mobile Contact navigation works from the signed-in account page',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,width:390});
    try {
        await s.goto('/');await s.page.getByRole('button',{name:'Open menu',exact:true}).click();
        await s.page.locator('.mobile-menu').getByRole('link',{name:'Contact',exact:true}).click();
        await s.page.getByRole('heading',{name:'Contact us',exact:true}).waitFor();
        assert.equal(await s.page.getByRole('button',{name:'Open menu',exact:true}).getAttribute('aria-expanded'),'false');
    }finally{await s.close();}
});

for(const width of [390,1440])test(`insurance form uses ordered highlighted buttons and submits all four fields at ${width}px`,async()=>{
    const s=await scenario({width});
    try {
        await s.goto('/insurance.html');const form=s.page.locator('#insurance-form'),choices=form.locator('.insurance-choice');
        assert.deepEqual(await choices.allTextContents(),['Home','Auto','Life','Business']);
        assert.deepEqual(await form.locator('.input-group > label').allTextContents(),['Full Name','Email','Phone #','Address']);
        assert.equal(await form.locator('[type="checkbox"]').count(),0);
        const home=form.getByRole('button',{name:'Home',exact:true}),auto=form.getByRole('button',{name:'Auto',exact:true});
        await home.click();assert.equal(await home.getAttribute('aria-pressed'),'true');
        await s.page.waitForFunction(()=>{const form=document.getElementById('insurance-form');return getComputedStyle(form.querySelector('[data-insurance-type="Home Insurance"]')).backgroundColor!==getComputedStyle(form.querySelector('[data-insurance-type="Auto Insurance"]')).backgroundColor;});
        await auto.focus();await s.page.keyboard.press('Space');assert.equal(await auto.getAttribute('aria-pressed'),'true');await s.page.keyboard.press('Space');
        await form.getByRole('button',{name:'Business',exact:true}).click();
        await form.getByLabel('Full Name',{exact:true}).fill('Test Insured');await form.getByLabel('Email',{exact:true}).fill('insured@example.com');
        await form.getByLabel('Phone #',{exact:true}).fill('(773) 555-1234');await form.getByLabel('Address',{exact:true}).fill(property.address);
        await form.screenshot({path:`/tmp/cookcounty-insurance-form-${width}.png`});
        assert.ok(await s.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        await form.getByRole('button',{name:'Request a Personal Consultation',exact:true}).click();await form.getByRole('status').getByText(/Request received/).waitFor();
        const sent=s.store.contacts[0];assert.deepEqual(sent.insuranceTypes,['Home Insurance','Business Insurance']);assert.equal(sent.propertyAddress,property.address);assert.equal(sent.name,'Test Insured');
        assert.equal(await home.getAttribute('aria-pressed'),'false');assert.equal(await form.getByLabel('Address',{exact:true}).inputValue(),'');
    }finally{await s.close();}
});

test('insurance requires address and preserves details and selected buttons after submission failure',async()=>{
    const s=await scenario();
    try {
        await s.goto('/insurance.html');const form=s.page.locator('#insurance-form');
        await form.getByLabel('Full Name',{exact:true}).fill('Retry Owner');await form.getByLabel('Email',{exact:true}).fill('retry@example.com');await form.getByLabel('Phone #',{exact:true}).fill('7735551234');
        await form.getByRole('button',{name:'Home',exact:true}).click();await form.getByRole('button',{name:'Request a Personal Consultation',exact:true}).click();
        assert.equal(s.store.contacts.length,0);assert.equal(await form.getByLabel('Address',{exact:true}).evaluate(el=>el.validity.valueMissing),true);
        await form.getByLabel('Address',{exact:true}).fill(property.address);s.store.contactFails=true;
        await form.getByRole('button',{name:'Request a Personal Consultation',exact:true}).click();await form.getByRole('alert').getByText('Test submission failure',{exact:true}).waitFor();
        assert.equal(await form.getByRole('button',{name:'Home',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await form.getByLabel('Address',{exact:true}).inputValue(),property.address);
        s.store.contactFails=false;await form.getByRole('button',{name:'Request a Personal Consultation',exact:true}).click();await form.getByRole('status').getByText(/Request received/).waitFor();
        assert.equal(s.store.contacts.length,2);
    }finally{await s.close();}
});

test('packet header retains the logo and separates session details from account links at every width',async()=>{
    for(const email of [undefined,'vuchicago@gmail.com']) {
        const s=await scenario({email,access:Boolean(email),packetStatus:'intake'});
        try {
            await s.goto('/appeal-packet.html?id=free_fixture');
            if(email)await s.page.locator('.packet-session-email').getByText(email,{exact:true}).waitFor();
            else await s.page.getByRole('link',{name:'Sign in',exact:true}).waitFor();
            const brand=s.page.getByRole('link',{name:'Cook County Tax Compare home',exact:true});assert.equal(await brand.getAttribute('href'),'index.html');
            assert.equal(await s.page.getByRole('link',{name:'My account',exact:true}).getAttribute('href'),'index.html#user-dashboard');
            for(const width of [320,390,900,1440]) {
                await s.page.setViewportSize({width,height:900});
                const bounds=await s.page.evaluate(()=>{
                    const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
                    return {logo:box('.packet-brand'),icon:box('.packet-brand svg'),nav:box('.packet-account-nav'),session:box('#packet-session'),actions:box('.packet-account-actions')};
                });
                assert.ok(bounds.icon.width>0&&bounds.icon.height>0);assert.ok(bounds.nav.right<=width+1);
                assert.ok(bounds.session.right<=bounds.actions.left+1,`Session overlaps links at ${width}px`);
                assert.ok(width<=650?bounds.logo.bottom<=bounds.nav.top:bounds.logo.right<=bounds.nav.left);
                assert.ok(await s.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
                if(email&&[390,1440].includes(width))await s.page.locator('.packet-nav').screenshot({path:`/tmp/cookcounty-packet-account-header-${width}.png`});
            }
        }finally{await s.close();}
    }
});

test('long account emails wrap without crowding the packet account button',async()=>{
    const email='a.very.long.property.owner.account.for.testing@example.com';
    const s=await scenario({email,access:true,width:320,packetStatus:'intake'});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');await s.page.locator('.packet-session-email').getByText(email,{exact:true}).waitFor();
        const text=await s.page.locator('#packet-session').boundingBox(),actions=await s.page.locator('.packet-account-actions').boundingBox();
        assert.ok(text.x+text.width<=actions.x);assert.ok(actions.x+actions.width<=320);
        assert.ok(await s.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    }finally{await s.close();}
});

test('packet activity omits routine questionnaire entries while retaining generated-packet events',async()=>{
    const s=await scenario({email:'tester@example.com',access:true,packetStatus:'preparing',events:[{action:'questionnaire',status:'preparing',created_at:'2026-11-04 01:02:33'},{action:'packet',status:'review',created_at:'2026-11-04 01:03:33'}]});
    try {
        await s.goto('/appeal-packet.html?id=free_fixture');await s.page.getByText('Activity',{exact:true}).click();
        assert.equal(await s.page.getByText(/questionnaire:/).count(),0);
        assert.equal(await s.page.getByText(/packet: Review packet/).isVisible(),true);
    }finally{await s.close();}
});
