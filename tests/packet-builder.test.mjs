import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from '../assets/vendor/pdf-lib.esm.min.js';
import { assemblePacket } from '../functions/api/_packet_pdf.js';
import { preparationProblems, requirements } from '../packet-requirements.js';
import { transitionPacket } from '../functions/api/_packet_workflow.js';
const base = () => ({status:'preparing',version:0,propertySnapshot:{source:'Imported records; verify year',capturedAt:'2026-11-03',details:{homeSize:1400},comparables:[{pin:'12345678901234',address:'123 Test',homeSize:1400}]},intake:{ownerName:'Test Owner',mailingAddress:'123 Test',taxYear:2026,reason:'characteristics',explanation:'The county area is wrong. See measured plan.',requestedMarketValue:200000,pins:'12345678901234',filingDeadline:'2026-11-30',recordsConfirmed:true,documentsReviewed:true,residentialScope:true,ownResidence:true,selectedComparables:[]},documents:['application','notice','corrections'].map((category,n)=>({id:String(n),key:String(n),kind:'evidence',category,name:`${category}.pdf`,type:'application/pdf',size:100}))});
test('rental and conditional evidence cannot be omitted from packet assembly',()=>{
    const s=base(); assert.deepEqual(preparationProblems(s),[]);
    s.intake.ownResidence=false;s.intake.appraisal=true;s.intake.affidavit=true;
    assert.deepEqual(requirements(s).filter(r=>!r.done).map(r=>r.id),['photo','appraisal','affidavit']);
});
test('assessment comparisons cannot stand in for market-value evidence',()=>{
    const s=base();s.intake.reason='overvaluation';s.intake.selectedComparables=['1','2','3'];
    assert.ok(preparationProblems(s).some(x=>x.includes('Market-value')));
});
test('PDF assembly includes official application first and every supporting page',async()=>{
    const source=await PDFDocument.create();source.addPage([300,400]);
    const bytes=await source.save();
    const s=base();
    const out=await assemblePacket(s,{property_address:'123 Test'}, {get:async()=>({arrayBuffer:async()=>bytes})});
    const pdf=await PDFDocument.load(out);
    assert.equal(pdf.getPageCount(),6); // application, statement, imported data, index, notice, corrections
    assert.equal(pdf.getPage(0).getWidth(),300);
    assert.match(pdf.getTitle(),/2026 Assessor appeal/);
});
test('missing or corrupt evidence fails instead of silently producing an incomplete packet',async()=>{
    await assert.rejects(()=>assemblePacket(base(),{}, {get:async()=>null}),/Missing uploaded file/);
    await assert.rejects(()=>assemblePacket(base(),{}, {get:async()=>({arrayBuffer:async()=>new Uint8Array([1,2])})}),/Cannot assemble/);
    const s=base();s.documents=[];await assert.rejects(()=>assemblePacket(s,{},{}),/Complete these items/);
});
test('untrusted comparison IDs fail validation; evidence changes are blocked after review',()=>{
    const s=base(), actor={isOwner:true,uid:'owner'};
    const input={action:'intake',...s.intake,agency:'assessor',individualOwner:true,noExistingAppeal:true,selectedComparables:['forged']};
    assert.throws(()=>transitionPacket(s,input,actor),/Select comparisons/);
    assert.equal(transitionPacket(s,{...input,selectedComparables:['12345678901234']},actor).intake.selectedComparables.length,1);
    assert.equal(transitionPacket(s,{action:'remove_evidence',documentId:'1'},actor).documents.length,2);
    assert.throws(()=>transitionPacket({...s,status:'approved'},{action:'remove_evidence',documentId:'1'},actor),/current stage/);
});
