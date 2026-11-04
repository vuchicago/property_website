import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPacket, transitionPacket } from '../functions/api/_packet_workflow.js';
import { MAIL_FULFILLMENT_AMOUNT_CENTS } from '../functions/api/_packet_pricing.js';

const owner = { uid: 'owner', isOwner: true, isAdmin: false };
const admin = { uid: 'admin', isOwner: false, isAdmin: true };
const now = '2026-11-03T15:00:00.000Z';
const intake = { action: 'intake', agency: 'assessor', taxYear: 2026, ownerName: 'Test Owner', mailingAddress: '123 Test Street', reason: 'uniformity', explanation: 'Similar properties have lower assessments.', individualOwner: true, noExistingAppeal: true };
const run = (s, input, actor = admin) => transitionPacket(s, input, actor, now);
const doc = (kind, version = 1) => ({ id: `${kind}-${version}`, kind, version });
function signed() {
    let s = run(initialPacket(), intake, owner);
    s = run(s, { action: 'packet', document: doc('packet') });
    s = run(s, { action: 'approve', confirmed: true }, owner);
    s = run(s, { action: 'request_signature', acceptanceChecked: true, envelopeId: 'test-envelope', reviewNotes: 'Agency acceptance checked; no notarization required for selected forms.' });
    s = run(s, { action: 'signed_packet', document: doc('signed_packet') });
    s = run(s, { action: 'certificate', document: doc('certificate') });
    return run(s, { action: 'confirm_signed', completionVerified: true });
}
const mail = { action: 'mail', rulesChecked: true, recipient: 'Verified agency mailing address', carrier: 'USPS', tracking: 'TEST123', mailedOn: '2026-11-03', filingDeadline: '2026-11-06', reviewNotes: 'Reviewed official instructions, copies, timeliness and ministerial mailing eligibility.', document: doc('mailing_proof') };

test('fulfillment price is fixed at $49', () => assert.equal(MAIL_FULFILLMENT_AMOUNT_CENTS, 4900));
test('complete preparation, signing, consent, mailing and county confirmation', () => {
    let s = signed();
    assert.equal(s.status, 'signed');
    s = run(s, { action: 'authorize_mail', confirmed: true }, owner);
    s = run(s, mail);
    assert.equal(s.status, 'mailed');
    assert.equal(s.filing, undefined);
    s = run(s, { action: 'filed', docket: 'County-123', confirmedOn: '2026-11-03', document: doc('filing_receipt') });
    assert.equal(s.status, 'filed');
    assert.equal(s.filing.receiptId, 'filing_receipt-1');
});
test('owner cannot certify signatures, mail, or assert county filing', () => {
    for (const action of ['request_signature', 'confirm_signed', 'mail', 'filed']) assert.throws(() => run(signed(), { action }, owner), /administrator/);
});
test('admin cannot impersonate owner intake, approval, or mailing consent', () => {
    for (const action of ['intake', 'approve', 'authorize_mail']) assert.throws(() => run(initialPacket(), { ...intake, action }), /account owner/);
});
test('mailing requires owner consent, current signed version, proof and rule review', () => {
    assert.throws(() => run(signed(), mail), /authorize mailing/);
    const authorized = run(signed(), { action: 'authorize_mail', confirmed: true }, owner);
    assert.throws(() => run(authorized, { ...mail, rulesChecked: false }), /Verify current/);
    assert.throws(() => run(authorized, { ...mail, document: doc('mailing_proof', 0) }), /this packet version/);
    assert.throws(() => run(authorized, { ...mail, mailedOn: '2026-11-04' }), /after dispatch/);
    assert.throws(() => run(authorized, { ...mail, filingDeadline: '2026-11-02' }), /after the recorded/);
    assert.throws(() => run(authorized, { ...mail, mailedOn: '2026-99-99' }), /valid date/);
});
test('revision clears approvals and signatures, and requires voiding an existing envelope', () => {
    const original = run(signed(), { action: 'authorize_mail', confirmed: true }, owner);
    assert.throws(() => run(original, { action: 'revise' }), /Void/);
    let revised = run(original, { action: 'revise', envelopeVoided: true });
    assert.equal(revised.mailingConsent, undefined);
    assert.equal(revised.signedId, undefined);
    assert.equal(revised.signedAt, undefined);
    revised = run(revised, { action: 'packet', document: doc('packet', 2) });
    assert.equal(revised.version, 2);
    assert.equal(revised.status, 'review');
    assert.throws(() => run(revised, mail), /current stage/);
    assert.equal(original.status, 'signed');
});
test('intake screens ownership and duplicate filings', () => {
    assert.throws(() => run(initialPacket(), { ...intake, individualOwner: false }, owner), /individual taxpayer/);
    assert.throws(() => run(initialPacket(), { ...intake, noExistingAppeal: false }, owner), /existing appeal/);
});
test('signature confirmation requires both completed documents', () => {
    const s = signed(); s.status = 'awaiting_signature'; delete s.certificateId;
    assert.throws(() => run(s, { action: 'confirm_signed', completionVerified: true }), /completion certificate/);
});

test('owners can assemble their own packet and Board appeals are excluded',()=>{
    let s=run(initialPacket(),intake,owner);
    s=run(s,{action:'packet',document:doc('packet')},owner);
    assert.equal(s.status,'review');
    assert.throws(()=>run(initialPacket(),{...intake,agency:'board_of_review'},owner),/Assessor appeals only/);
});
test('postal delivery remains distinct from county filing',()=>{
    let s=run(signed(),{action:'authorize_mail',confirmed:true},owner);
    s=run(s,mail);s=run(s,{action:'delivered',deliveredOn:'2026-11-03',document:doc('delivery_proof')});
    assert.equal(s.status,'delivered');assert.equal(s.filing,undefined);
});

test('questionnaire progress saves partial answers without approving or submitting an appeal',()=>{
    const initial={...initialPacket(),propertySnapshot:{details:{taxableValue:30000},comparables:[{pin:'00000000000001',taxableValue:20000}]}};
    const next=run(initial,{action:'questionnaire',step:'contact',answers:{singleFamilyScope:true,recordsConfirmed:true,individualOwner:true,ownerName:'Test Owner',requestedMarketValue:'',selectedComparables:['00000000000001']}},owner);
    assert.equal(next.status,'intake');assert.equal(next.version,0);assert.equal(next.intake,undefined);assert.equal(next.approval,undefined);
    assert.equal(JSON.parse(JSON.stringify(next)).questionnaire.step,'contact');
    assert.equal(next.questionnaire.answers.ownerName,'Test Owner');
    assert.equal(initial.questionnaire,undefined);
});
test('questionnaire writes require ownership, preparation stage and bounded allowed fields',()=>{
    const draft={action:'questionnaire',step:'contact',answers:{ownerName:'Test Owner'}};
    assert.throws(()=>run(initialPacket(),draft,admin),/account owner/);
    assert.throws(()=>run({...initialPacket(),status:'approved'},draft,owner),/current stage/);
    assert.throws(()=>run(initialPacket(),{...draft,answers:{documents:[]}},owner),/Unknown questionnaire field/);
    assert.throws(()=>run(initialPacket(),{...draft,answers:{ownerName:'a'.repeat(201)}},owner),/too long/);
    assert.throws(()=>run(initialPacket(),{...draft,answers:{selectedComparables:['foreign']}},owner),/this property record/);
});
