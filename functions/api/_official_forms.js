import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFSignature, PDFName, StandardFonts } from '../../assets/vendor/pdf-lib.esm.min.js';
import { impliedMarketValue, RESIDENTIAL_ASSESSMENT_RATIO } from '../../packet-comparisons.js';

export const FORM_KINDS = {application:'Official Assessor appeal application',photo_attestation:'Official photo-date attestation',attestation:'Official attestation'};
export const FORM_SOURCES = {application:'https://www.cookcountyassessoril.gov/form-document/residential-appeal-form',photo_attestation:'https://www.cookcountyassessoril.gov/forms',attestation:'https://www.cookcountyassessoril.gov/forms'};
export const FORM_VALUES = {
    taxYear:'Assessment year',ownerName:'Legal owner name',ownerEmail:'Account email',ownerPhone:'Phone number',mailingAddress:'Mailing street address',mailingCity:'Mailing city',mailingState:'Mailing state',mailingZip:'Mailing ZIP',
    propertyAddress:'Property address',propertyCity:'Property city',propertyZip:'Property ZIP',township:'Township',primaryPin:'Primary PIN',allPins:'All PINs',classCode:'Property class',assessedValue:'Current assessed value',estimatedMarketValue:'Current estimated market value',requestedMarketValue:'Requested fair market value',requestedAssessedValue:'Requested assessed value',reason:'Appeal grounds',explanation:'Owner statement',
    singleFamily:'Single-family home',owner:'Taxpayer is owner',currentYearAppeal:'Current-year appeal only',residential:'Residential property',entireProperty:'Appeal covers the entire property',uniformity:'Uniformity grounds',overvaluation:'Overvaluation grounds',characteristics:'Characteristics grounds',
    ownResidence:'Owner lives at the property',recentSale:'Recent purchase disclosed',appraisal:'Existing appraisal disclosed',damage:'Condition or damage grounds',affidavit:'Requested attestation',
    purchaseDate:'Purchase date',purchasePrice:'Purchase price',sellerName:'Seller name',saleRelationship:'Buyer/seller relationship',photoDate:'Photo date',attestationFacts:'Facts to attest'
};
const REQUIRED_APPLICATION_VALUES = ['taxYear','ownerName','ownerEmail','ownerPhone','mailingAddress','mailingCity','mailingState','mailingZip','propertyAddress','propertyCity','primaryPin','township','requestedMarketValue'];
const fail = message => {throw Object.assign(new Error(message),{status:400});};
const prefix = (year,kind) => `official-forms/assessor/${year}/${kind}`;
export const formManifestKey = (year,kind) => `${prefix(year,kind)}/published.json`;
const isSignature = field => field instanceof PDFSignature || /signature|signed.?date|date.?signed/i.test(field.getName());
const sourcesFor = entry => entry.source?[entry.source]:typeof entry.template==='string'?[...entry.template.matchAll(/\{\{([A-Za-z]+)\}\}/g)].map(match=>match[1]):[];
export async function inspectOfficialForm(bytes) {
    const pdf=await PDFDocument.load(bytes);
    if (pdf.isEncrypted || pdf.getPageCount()>20) fail('Use an unlocked official form with no more than 20 pages.');
    const fields=pdf.getForm().getFields().map(field=>{
        if(field instanceof PDFSignature && field.acroField.dict.get(PDFName.of('V'))?.toString() && field.acroField.dict.get(PDFName.of('V')).toString()!=='null')fail('Import an unsigned official template.');
        if(isSignature(field) && field instanceof PDFTextField && field.getText()?.trim())fail('Import an official template with blank signatures and signature dates.');
        return {name:field.getName(),type:field instanceof PDFTextField?'PDFTextField':field instanceof PDFCheckBox?'PDFCheckBox':field instanceof PDFDropdown?'PDFDropdown':field instanceof PDFRadioGroup?'PDFRadioGroup':'unsupported',signature:isSignature(field),options:field.getOptions?.() || null};
    });
    if (!fields.some(field=>!field.signature)) fail('This PDF has no fillable fields. Import a fillable official form; do not substitute a recreated application.');
    return {pages:pdf.getPageCount(),fields};
}
export async function validateFormMapping(bytes, kind, mapping) {
    if (!FORM_KINDS[kind] || !mapping || typeof mapping!=='object' || Array.isArray(mapping)) fail('Choose a valid form and field mapping.');
    const inspected=await inspectOfficialForm(bytes);
    const names=new Set(inspected.fields.map(field=>field.name));
    for(const name of Object.keys(mapping)) if(!names.has(name)) fail(`Unknown PDF field: ${name}`);
    const used=new Set();
    for(const field of inspected.fields) {
        const entry=mapping[field.name];
        if(field.signature) {if(entry && !entry.skip)fail('Signature and signature-date fields must remain blank.');continue;}
        if(!entry || typeof entry!=='object')fail(`Map or explicitly skip PDF field: ${field.name}`);
        if(entry.skip) {if(typeof entry.reason!=='string'||!entry.reason.trim())fail(`Explain why ${field.name} is not applicable.`);continue;}
        if(entry.source || entry.template) {
            const sources=sourcesFor(entry);
            if(!sources.length || sources.some(source=>!Object.hasOwn(FORM_VALUES,source)))fail(`Unknown data source for ${field.name}`);
            if(entry.template && (field.type!=='PDFTextField' || typeof entry.template!=='string' || entry.template.length>10000))fail('Combined text templates require a text field and at most 10,000 characters.');
            const booleanSource=['singleFamily','owner','currentYearAppeal','residential','entireProperty','uniformity','overvaluation','characteristics','ownResidence','recentSale','appraisal','damage','affidavit'].includes(entry.source);
            if(field.type==='PDFCheckBox' && !booleanSource)fail(`Use a checkbox value for ${field.name}`);
            for(const source of sources)used.add(source);
        } else if(!Object.hasOwn(entry,'literal') || !['string','boolean'].includes(typeof entry.literal))fail(`Choose a source or literal for ${field.name}`);
        if(!['PDFTextField','PDFCheckBox','PDFDropdown','PDFRadioGroup'].includes(field.type))fail(`Unsupported field type: ${field.name}`);
        if(field.type==='PDFCheckBox' && Object.hasOwn(entry,'literal') && typeof entry.literal!=='boolean')fail(`Use true or false for ${field.name}`);
        if(entry.invert!==undefined && (typeof entry.invert!=='boolean' || field.type!=='PDFCheckBox'))fail('Only checkbox mappings can invert a boolean value.');
        if(entry.fontSize!==undefined && (!Number.isFinite(entry.fontSize)||entry.fontSize<6||entry.fontSize>14))fail('Form font size must be between 6 and 14.');
        if(field.options && Object.hasOwn(entry,'literal') && !field.options.includes(entry.literal))fail(`Choose a listed option for ${field.name}`);
    }
    const required=kind==='application'?REQUIRED_APPLICATION_VALUES:kind==='photo_attestation'?['ownerName','propertyAddress','primaryPin','photoDate']:['ownerName','propertyAddress','primaryPin','attestationFacts'];
    for(const source of required) if(!used.has(source))fail(`The template must map ${FORM_VALUES[source]}.`);
    if(kind==='application') {
        for(const source of ['singleFamily','owner','currentYearAppeal','residential']) if(!used.has(source))fail(`The template must map ${FORM_VALUES[source]}.`);
        if(!used.has('reason') && !['uniformity','overvaluation','characteristics'].every(source=>used.has(source)))fail('Map the appeal grounds text or all three supported grounds checkboxes.');
    }
    return inspected;
}
export function officialFormValues(state, appeal = {}) {
    const i=state.intake || {},s=state.propertySnapshot || {},d=s.details || {};
    const pins=String(i.pins || s.pin || appeal.property_pin || '').split(/[,;\n]+/).map(pin=>pin.replace(/[-\s]/g,'')).filter(Boolean);
    const photo=(state.documents || []).find(doc=>doc.kind==='evidence'&&doc.category==='photo');
    return {...i,taxYear:i.taxYear || state.taxYear,ownerEmail:appeal.customer_email || '',ownerPhone:i.ownerPhone || '',propertyAddress:s.address || appeal.property_address || '',propertyCity:i.propertyCity || d.city || '',propertyZip:i.propertyZip || d.zipCode || '',township:d.townshipName || '',primaryPin:pins[0] || '',allPins:pins.join(', '),classCode:d.classCode || '',assessedValue:d.taxableValue ?? '',estimatedMarketValue:impliedMarketValue(d.taxableValue) ?? '',requestedAssessedValue:i.requestedMarketValue==null?'':i.requestedMarketValue*RESIDENTIAL_ASSESSMENT_RATIO,
        reason:({uniformity:'Lack of uniformity',overvaluation:'Overvaluation',characteristics:'Incorrect property characteristics'})[i.reason] || '',singleFamily:true,owner:true,currentYearAppeal:true,residential:true,entireProperty:true,uniformity:i.reason==='uniformity',overvaluation:i.reason==='overvaluation',characteristics:i.reason==='characteristics',photoDate:photo?.photoDate || ''};
}
export function requiredOfficialForms(state) {
    const kinds=['application'];
    if((state.documents || []).some(doc=>doc.kind==='evidence'&&doc.category==='photo'&&doc.dateStamped!==true)) kinds.push('photo_attestation');
    if(state.intake?.affidavit) kinds.push('attestation');
    return kinds;
}
async function loadOfficialForms(storage,state,appeal = {}) {
    const values=officialFormValues(state,appeal),year=state.intake?.taxYear || state.taxYear;
    return Promise.all(requiredOfficialForms(state).map(async kind=>{
        const object=storage?await storage.get(formManifestKey(year,kind)):null;
        if(!object)return{kind,title:FORM_KINDS[kind],ready:false,sourceUrl:FORM_SOURCES[kind],missingValues:[]};
        const manifest=await object.json();
        const needed=new Set((kind==='application'?REQUIRED_APPLICATION_VALUES:kind==='photo_attestation'?['ownerName','propertyAddress','primaryPin','photoDate']:['ownerName','propertyAddress','primaryPin','attestationFacts']));
        for(const entry of Object.values(manifest.mapping)) if(entry.required)for(const source of sourcesFor(entry))needed.add(source);
        const missingValues=[...needed].filter(source=>values[source]===undefined || values[source]===null || values[source]==='').map(source=>({source,label:FORM_VALUES[source]}));
        return {kind,title:FORM_KINDS[kind],ready:true,sourceUrl:manifest.sourceUrl,revision:manifest.revision,missingValues,manifest};
    }));
}
export async function officialFormsStatus(storage,state,appeal = {}) {
    return (await loadOfficialForms(storage,state,appeal)).map(({manifest,...status})=>status);
}
export async function prepareOfficialForms(storage,state,appeal,{allowIncomplete=false,onMissing=()=>{}}={}) {
    const available=await loadOfficialForms(storage,state,appeal),status=[];
    for(const form of available) {
        const issue=!form.ready?`The preparation desk needs to import ${form.title} for this assessment year. You do not need to download or upload blank forms.`:form.missingValues.length?`Please confirm: ${form.missingValues.map(item=>item.label).join(', ')}.`:null;
        if(issue) {if(allowIncomplete){onMissing(issue);continue;}throw Object.assign(new Error(issue),{status:form.ready?400:409});}
        status.push(form);
    }
    const values=officialFormValues(state,appeal),prepared=[];
    for(const entry of status) {
        const manifest=entry.manifest;
        const object=await storage.get(manifest.key);
        if(!object)throw Object.assign(new Error('An official form is unavailable. The preparation desk must restore it.'),{status:503});
        const pdf=await PDFDocument.load(await object.arrayBuffer()),form=pdf.getForm();
        const font=await pdf.embedFont(StandardFonts.Helvetica);
        for(const field of form.getFields()) {
            const mapping=manifest.mapping[field.getName()];
            if(isSignature(field)||mapping?.skip) {
                if(field instanceof PDFTextField)field.setText('');
                else if(field instanceof PDFCheckBox)field.uncheck();
                else if(field instanceof PDFDropdown || field instanceof PDFRadioGroup)field.clear();
                continue;
            }
            if(!mapping)fail(`Official form mapping is incomplete: ${field.getName()}`);
            let value=mapping.source ? values[mapping.source] : mapping.template?mapping.template.replace(/\{\{([A-Za-z]+)\}\}/g,(_,source)=>String(values[source] ?? '')):mapping.literal;
            if(mapping.invert)value=!value;
            if(field instanceof PDFTextField) {
                const text=value==null?'':String(value);
                if(field.getMaxLength() && text.length>field.getMaxLength())fail(`${FORM_VALUES[mapping.source] || field.getName()} does not fit the official form. Ask the preparation desk to review it.`);
                if(!field.isMultiline() && field.acroField.getWidgets().some(widget=>font.widthOfTextAtSize(text,mapping.fontSize || 9)>widget.getRectangle().width-6))fail(`${FORM_VALUES[mapping.source] || field.getName()} does not fit the official form. Ask the preparation desk to adjust its field mapping.`);
                if(field.isMultiline())for(const widget of field.acroField.getWidgets()) {
                    const box=widget.getRectangle(),size=mapping.fontSize || 9;let lines=0;
                    for(const paragraph of text.split('\n')) {
                        let width=0;lines++;
                        for(const word of paragraph.split(/\s+/)) {
                            const next=font.widthOfTextAtSize(word+' ',size);
                            if(next>box.width-8)fail(`${field.getName()} contains text too wide for the official form.`);
                            if(width+next>box.width-8){lines++;width=next;}else width+=next;
                        }
                    }
                    if(lines*size*1.2>box.height-4)fail(`${field.getName()} does not fit the official form. Ask the preparation desk to review its text.`);
                }
                field.setText(text);field.setFontSize(mapping.fontSize || 9);
            } else if(field instanceof PDFCheckBox) {if(value===true)field.check();else field.uncheck();}
            else if(field instanceof PDFDropdown || field instanceof PDFRadioGroup) {if(value!==undefined && value!==null && value!==''){if(!field.getOptions().includes(String(value)))fail(`The official form cannot represent ${field.getName()}.`);field.select(String(value));}}
        }
        form.updateFieldAppearances(font);form.flatten();
        prepared.push({kind:entry.kind,title:entry.title,bytes:await pdf.save(),revision:manifest.revision,sourceUrl:manifest.sourceUrl});
    }
    return prepared;
}
