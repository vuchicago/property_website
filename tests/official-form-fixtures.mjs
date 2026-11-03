// Synthetic form for local tests only. Never installed or published as a county form.
import { PDFDocument } from '../assets/vendor/pdf-lib.esm.min.js';
import { formManifestKey } from '../functions/api/_official_forms.js';
export async function formFixture({kind='application',mapping:overrides={}}={}) {
    const pdf=await PDFDocument.create(),page=pdf.addPage([612,792]),form=pdf.getForm();
    const sources=kind==='application'?['taxYear','ownerName','ownerEmail','ownerPhone','mailingAddress','mailingCity','mailingState','mailingZip','propertyAddress','propertyCity','primaryPin','township','requestedMarketValue','reason']:kind==='photo_attestation'?['ownerName','propertyAddress','primaryPin','photoDate']:['ownerName','propertyAddress','primaryPin','attestationFacts'];
    const mapping={};
    sources.forEach((source,index)=>{form.createTextField(source).addToPage(page,{x:40,y:740-index*35,width:510,height:25});mapping[source]={source,required:true};});
    if(kind==='application')for(const [index,source] of ['singleFamily','owner','currentYearAppeal','residential'].entries()) {
        form.createCheckBox(source).addToPage(page,{x:40+index*100,y:190,width:15,height:15});mapping[source]={source};
    }
    form.createTextField('Owner Signature').addToPage(page,{x:40,y:80,width:400,height:25});mapping['Owner Signature']={skip:true,reason:'Owner signs after review'};
    const bytes=await pdf.save();
    const manifest={kind,year:2026,key:`fixture/${kind}.pdf`,revision:`synthetic-${kind}`,sourceUrl:'https://www.cookcountyassessoril.gov/form-document/residential-appeal-form',mapping:{...mapping,...overrides}};
    const objects=new Map([[formManifestKey(2026,kind),{json:async()=>manifest}],[manifest.key,{arrayBuffer:async()=>bytes}]]);
    return {bytes,manifest,objects};
}
export async function fixtureStorage(evidenceGet, kinds=['application']) {
    const objects=new Map();
    for(const kind of kinds)for(const [key,value] of (await formFixture({kind})).objects)objects.set(key,value);
    return {async get(key){return objects.has(key)?objects.get(key):evidenceGet(key);}};
}
