import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFRawStream, decodePDFRawStream } from '../assets/vendor/pdf-lib.esm.min.js';
import { assemblePacket } from '../functions/api/_packet_pdf.js';
import { preparationProblems, requirements } from '../packet-requirements.js';
import { transitionPacket } from '../functions/api/_packet_workflow.js';
import { fixtureStorage } from './official-form-fixtures.mjs';
const base = () => ({status:'preparing',version:0,propertySnapshot:{source:'Imported records; verify year',capturedAt:'2026-11-03',details:{homeSize:1400},comparables:[{pin:'12345678901234',address:'123 Test',homeSize:1400}]},intake:{ownerName:'Test Owner',mailingAddress:'123 Test',taxYear:2026,reason:'characteristics',explanation:'The county area is wrong. See measured plan.',requestedMarketValue:200000,pins:'12345678901234',recordsConfirmed:true,documentsReviewed:true,singleFamilyScope:true,ownResidence:true,selectedComparables:[]},documents:['application','notice','corrections'].map((category,n)=>({id:String(n),key:String(n),kind:'evidence',category,name:`${category}.pdf`,type:'application/pdf',size:100}))});
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
    Object.assign(s.intake,{ownerPhone:'3125550100',mailingCity:'Chicago',mailingState:'IL',mailingZip:'60601',propertyCity:'Skokie'});s.propertySnapshot.details.townshipName='Niles';
    const out=await assemblePacket(s,{property_address:'123 Test',customer_email:'owner@example.com'}, await fixtureStorage(async()=>({arrayBuffer:async()=>bytes})));
    const pdf=await PDFDocument.load(out);
    assert.equal(pdf.getPageCount(),6); // application, statement, imported data, index, notice, corrections
    assert.equal(pdf.getPage(0).getWidth(),612);
    assert.match(pdf.getTitle(),/2026 Assessor appeal/);
});
test('missing or corrupt evidence fails instead of silently producing an incomplete packet',async()=>{
    const complete=()=>{const s=base();Object.assign(s.intake,{ownerPhone:'3125550100',mailingCity:'Chicago',mailingState:'IL',mailingZip:'60601',propertyCity:'Skokie'});s.propertySnapshot.details.townshipName='Niles';return s;};
    const appeal={property_address:'123 Test',customer_email:'owner@example.com'};
    await assert.rejects(async()=>assemblePacket(complete(),appeal,await fixtureStorage(async()=>null)),/Missing uploaded file/);
    await assert.rejects(async()=>assemblePacket(complete(),appeal,await fixtureStorage(async()=>({arrayBuffer:async()=>new Uint8Array([1,2])}))),/Cannot assemble/);
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

test('free preparation copy downloads collected data before templates or evidence are ready',async()=>{
    const state={taxYear:2026,status:'intake',version:0,documents:[],propertySnapshot:{address:'123 Test Ave',pin:'00000000000001',details:{classCode:'203',townshipName:'Niles'},capturedAt:'2026-11-03',source:'Imported county record'}};
    const storage={get:async()=>null};
    const bytes=await assemblePacket(state,{property_address:'123 Test Ave'},storage,{preparationCopy:true});
    const pdf=await PDFDocument.load(bytes);
    assert.match(pdf.getTitle(),/preparation copy - NOT READY TO FILE/);
    const text=pdf.context.enumerateIndirectObjects().flatMap(([,object])=>{
        if(!(object instanceof PDFRawStream))return[];
        let content;try{content=Buffer.from(decodePDFRawStream(object).decode()).toString();}catch{return[];}
        return [...content.matchAll(/<([a-f0-9]+)>/ig)].map(match=>Buffer.from(match[1],'hex').toString());
    }).join('\n');
    assert.match(text,/PREPARATION COPY - NOT READY TO FILE/);
    assert.match(text,/needs to import/);
    assert.ok(text.includes('00000000000001'));
    assert.ok(text.includes('Niles'));
    assert.ok(pdf.getPageCount()>=4);
    assert.equal(state.version,0);assert.equal(state.status,'intake');assert.equal(state.documents.length,0);
    await assert.rejects(()=>assemblePacket(state,{property_address:'123 Test Ave'},storage),/Complete these items/);
});
