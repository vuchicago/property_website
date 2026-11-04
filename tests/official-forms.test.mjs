import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFRawStream, decodePDFRawStream } from '../assets/vendor/pdf-lib.esm.min.js';
import { singleFamilyEligibility } from '../packet-scope.js';
import { officialFormsStatus, prepareOfficialForms, validateFormMapping, inspectOfficialForm, formManifestKey, officialFormValues } from '../functions/api/_official_forms.js';
import { formFixture, fixtureStorage } from './official-form-fixtures.mjs';
import { transitionPacket } from '../functions/api/_packet_workflow.js';

const state=()=>({service:'assessor_self_service',taxYear:2026,status:'preparing',documents:[],propertySnapshot:{address:'123 TEST AVE',pin:'00000000000001',details:{classCode:'203',townshipName:'Niles'}},intake:{taxYear:2026,ownerName:'Test Owner',ownerPhone:'3125550100',mailingAddress:'99 Owner St',mailingCity:'Chicago',mailingState:'IL',mailingZip:'60601',propertyCity:'Skokie',pins:'00000000000001',requestedMarketValue:200000,reason:'uniformity',singleFamilyScope:true}});
const appeal={customer_email:'owner@example.com',property_address:'123 TEST AVE'};
test('official form values retain assessment fields and derive market values at the residential ratio',()=>{
    const s=state();s.propertySnapshot.details.taxableValue=30000;
    const values=officialFormValues(s,appeal);
    assert.equal(values.assessedValue,30000);assert.equal(values.estimatedMarketValue,300000);assert.equal(values.requestedAssessedValue,20000);
    s.propertySnapshot.details.taxableValue=null;assert.equal(officialFormValues(s,appeal).estimatedMarketValue,'');
});
function pdfText(pdf) {
    const chunks=[];
    for(const [,object] of pdf.context.enumerateIndirectObjects())if(object instanceof PDFRawStream) {
        let content;try{content=Buffer.from(decodePDFRawStream(object).decode()).toString();}catch{continue;}
        for(const match of content.matchAll(/<([A-Fa-f0-9]+)>/g))chunks.push(Buffer.from(match[1],'hex').toString());
    }
    return chunks.join('\n');
}

test('single-family eligibility excludes condos, multi-family, mixed-use and commercial records',()=>{
    for(const classCode of ['202','203','210','234','278','295'])assert.equal(singleFamilyEligibility({classCode}).eligible,true);
    for(const classCode of ['211','212','218','219','299','501','EX'])assert.equal(singleFamilyEligibility({classCode}).eligible,false);
    assert.equal(singleFamilyEligibility({classCode:'203',singleVsMultiFamily:'Multi Family'}).eligible,false);
    assert.equal(singleFamilyEligibility({}).eligible,null);
});

test('out-of-scope properties cannot bypass intake by claiming single-family ownership',()=>{
    const s=state();s.status='intake';s.propertySnapshot.details.classCode='299';
    assert.throws(()=>transitionPacket(s,{action:'intake',...s.intake,agency:'assessor',explanation:'My facts',individualOwner:true,noExistingAppeal:true,recordsConfirmed:true,ownResidence:true,selectedComparables:[]},{isOwner:true,freePacket:true}),/single-family homes/);
});

test('official template mappings require coverage, explicit skips and blank signatures',async()=>{
    const f=await formFixture();
    const inspected=await validateFormMapping(f.bytes,'application',f.manifest.mapping);
    assert.ok(inspected.fields.some(field=>field.name==='Owner Signature'&&field.signature));
    const missing=structuredClone(f.manifest.mapping);delete missing.ownerName;
    await assert.rejects(()=>validateFormMapping(f.bytes,'application',missing),/Map or explicitly skip/);
    const skipped=structuredClone(f.manifest.mapping);skipped.ownerName={skip:true,reason:'Not supplied'};
    await assert.rejects(()=>validateFormMapping(f.bytes,'application',skipped),/must map Legal owner name/);
    const signed=structuredClone(f.manifest.mapping);signed['Owner Signature']={source:'ownerName'};
    await assert.rejects(()=>validateFormMapping(f.bytes,'application',signed),/must remain blank/);
    const pdf=await PDFDocument.load(f.bytes);pdf.getForm().getTextField('Owner Signature').setText('Someone else');
    await assert.rejects(async()=>inspectOfficialForm(await pdf.save()),/blank signatures/);
});

test('prefilling uses the owner and property data and leaves signatures blank in the flattened PDF',async()=>{
    const storage=await fixtureStorage(async()=>null);
    const before=await officialFormsStatus(storage,state(),appeal);
    assert.equal(before[0].ready,true);assert.deepEqual(before[0].missingValues,[]);
    assert.equal('manifest' in before[0],false);
    const prepared=await prepareOfficialForms(storage,state(),appeal);
    const pdf=await PDFDocument.load(prepared[0].bytes);
    assert.equal(pdf.getPageCount(),1);
    assert.equal(pdf.getForm().getFields().length,0);
    const text=pdfText(pdf);
    for(const value of ['Test Owner','owner@example.com','123 TEST AVE','00000000000001','200000','Niles'])assert.ok(text.includes(value),value);
    assert.equal(text.includes('Someone else'),false);
});

test('blank official templates are a service prerequisite rather than an owner upload requirement',async()=>{
    const status=await officialFormsStatus({get:async()=>null},state(),appeal);
    assert.equal(status[0].ready,false);
    await assert.rejects(()=>prepareOfficialForms({get:async()=>null},state(),appeal),error=>error.status===409&&/You do not need to download or upload blank forms/.test(error.message));
});

test('only missing owner values are requested and old-year templates do not satisfy another year',async()=>{
    const storage=await fixtureStorage(async()=>null),s=state();delete s.intake.ownerPhone;
    const forms=await officialFormsStatus(storage,s,appeal);
    assert.deepEqual(forms[0].missingValues,[{source:'ownerPhone',label:'Phone number'}]);
    await assert.rejects(()=>prepareOfficialForms(storage,s,appeal),/confirm: Phone number/);
    s.intake.taxYear=2027;s.taxYear=2027;
    assert.equal((await officialFormsStatus(storage,s,appeal))[0].ready,false);
});

test('photo-date attestations are included only for photos without a visible date',async()=>{
    const s=state();s.documents=[{kind:'evidence',category:'photo',photoDate:'2026-01-01',dateStamped:false}];
    const storage=await fixtureStorage(async()=>null,['application','photo_attestation']);
    const forms=await prepareOfficialForms(storage,s,appeal);
    assert.deepEqual(forms.map(form=>form.kind),['application','photo_attestation']);
    const text=pdfText(await PDFDocument.load(forms[1].bytes));assert.ok(text.includes('2026-01-01'));
    s.documents[0].dateStamped=true;
    assert.deepEqual((await prepareOfficialForms(storage,s,appeal)).map(form=>form.kind),['application']);
});

test('missing official template bytes and values that do not fit cannot produce a packet',async()=>{
    const f=await formFixture();
    f.objects.delete(f.manifest.key);
    await assert.rejects(()=>prepareOfficialForms({get:async key=>f.objects.get(key)},state(),appeal),/unavailable/);
    const storage=await fixtureStorage(async()=>null),s=state();s.intake.ownerName='Long owner name '.repeat(30);
    await assert.rejects(()=>prepareOfficialForms(storage,s,appeal),/does not fit/);
});

test('a generic official attestation can combine owner, property and photo facts in one field',async()=>{
    const pdf=await PDFDocument.create(),page=pdf.addPage([612,792]),form=pdf.getForm();
    const facts=form.createTextField('Facts');facts.enableMultiline();facts.addToPage(page,{x:40,y:200,width:510,height:400});
    const bytes=await pdf.save();
    const mapping={Facts:{template:'I, {{ownerName}}, confirm that the photo of {{propertyAddress}}, PIN {{primaryPin}}, was taken on {{photoDate}}.',required:true}};
    await validateFormMapping(bytes,'photo_attestation',mapping);
    const s=state();s.documents=[{kind:'evidence',category:'photo',photoDate:'2026-01-01',dateStamped:false}];
    const app=await formFixture(),objects=new Map(app.objects);
    objects.set(formManifestKey(2026,'photo_attestation'),{json:async()=>({key:'combined.pdf',mapping,revision:'test-combined',sourceUrl:'https://www.cookcountyassessoril.gov/forms'})});
    objects.set('combined.pdf',{arrayBuffer:async()=>bytes});
    const result=await prepareOfficialForms({get:async key=>objects.get(key)},s,appeal);
    const text=pdfText(await PDFDocument.load(result[1].bytes));
    assert.ok(text.includes('Test Owner'));assert.ok(text.includes('2026-01-01'));
});
