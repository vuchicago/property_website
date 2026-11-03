import test from 'node:test';
import assert from 'node:assert/strict';
import { packetMailingWindow, requireOpenMailingWindow } from '../functions/api/_packet_mailing.js';
import { transitionPacket } from '../functions/api/_packet_workflow.js';

const packet = () => ({service:'assessor_self_service',taxYear:2026,status:'signed',version:1,documents:[],mailingConsent:{version:1},propertySnapshot:{details:{townshipName:'Niles'}}});
const mail = {action:'mail',rulesChecked:true,recipient:'Verified Assessor mailing address',carrier:'USPS',tracking:'TEST123',mailedOn:'2026-11-03',filingDeadline:'2026-01-01',reviewNotes:'Reviewed current mailing requirements.',document:{id:'proof',kind:'mailing_proof',version:1}};
const admin = {uid:'admin',isAdmin:true,isOwner:false,freePacket:true};

test('service calendar controls opening and closing using the Chicago date',()=>{
    const s=packet();
    assert.equal(packetMailingWindow(s,'2026-10-20T04:59:00Z').status,'upcoming');
    const open=packetMailingWindow(s,'2026-10-20T05:00:00Z');
    assert.equal(open.status,'open');
    assert.equal(open.opensOn,'2026-10-20');
    assert.equal(open.closesOn,'2026-12-03');
    assert.equal(packetMailingWindow(s,'2026-12-04T05:59:00Z').status,'open');
    assert.equal(packetMailingWindow(s,'2026-12-04T06:00:00Z').status,'closed');
});

test('missing, uncertain and other-year calendars hold mailing without inventing dates',()=>{
    for (const s of [ {...packet(),taxYear:2027}, {...packet(),propertySnapshot:{}}, {...packet(),propertySnapshot:{details:{townshipName:'Nile'}}} ]) {
        assert.equal(packetMailingWindow(s,'2026-11-03T15:00:00Z').status,'unannounced');
        assert.throws(()=>requireOpenMailingWindow(s,'2026-11-03T15:00:00Z'),error=>error.status===409);
    }
});

test('stale snapshot dates and customer-entered deadlines cannot change the mailing window',()=>{
    const s=packet();s.propertySnapshot.details.appealCalendar={reassessmentNoticeDate:'1/1/2025',lastFileDate:'12/31/2099'};
    const next=transitionPacket(s,mail,admin,'2026-11-03T15:00:00Z');
    assert.equal(next.status,'mailed');
    assert.equal(next.mailing.filingDeadline,'2026-12-03');
    assert.equal(next.mailing.calendar.township,'Niles');
    assert.equal(next.mailing.calendar.opensOn,'2026-10-20');
    assert.equal(s.status,'signed');
});

test('mailing rejects early dispatch, closed windows and unannounced assessment years',()=>{
    assert.throws(()=>transitionPacket(packet(),mail,admin,'2026-10-19T15:00:00Z'),/on hold until/);
    assert.throws(()=>transitionPacket(packet(),mail,admin,'2026-12-04T15:00:00Z'),/closed/);
    assert.throws(()=>transitionPacket({...packet(),taxYear:2027},mail,admin,'2026-11-03T15:00:00Z'),/published/);
    assert.throws(()=>transitionPacket(packet(),{...mail,mailedOn:'2026-10-19'},admin,'2026-11-03T15:00:00Z'),/before the township/);
});

test('owners can save complete preparation details without entering a deadline',()=>{
    const s={...packet(),status:'intake',propertySnapshot:{details:{townshipName:'Niles'},comparables:[]}};
    const next=transitionPacket(s,{action:'intake',agency:'assessor',taxYear:2026,ownerName:'Test Owner',mailingAddress:'123 Test Ave',reason:'characteristics',explanation:'Incorrect area',individualOwner:true,noExistingAppeal:true,requestedMarketValue:200000,singleFamilyScope:true,ownResidence:true,recordsConfirmed:true,pins:'00000000000001',selectedComparables:[]},{uid:'owner',isOwner:true,isAdmin:false},'2026-11-03T15:00:00Z');
    assert.equal(next.status,'preparing');
    assert.equal(next.intake.filingDeadline,undefined);
});
