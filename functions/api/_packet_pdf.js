import { PDFDocument, StandardFonts } from '../../assets/vendor/pdf-lib.esm.min.js';
import { preparationProblems } from '../../packet-requirements.js';
import { prepareOfficialForms } from './_official_forms.js';
import { singleFamilyEligibility } from '../../packet-scope.js';

export async function assemblePacket(state, appeal, storage, {preparationCopy=false}={}) {
    if(preparationCopy && state.questionnaire?.answers)state={...state,intake:{...state.intake,...state.questionnaire.answers,taxYear:state.intake?.taxYear || state.taxYear}};
    const problems=preparationProblems(state);
    if(singleFamilyEligibility(state.propertySnapshot?.details).eligible===false)throw Object.assign(new Error('Preparation downloads currently support single-family homes only.'),{status:400});
    if(!preparationCopy && problems.length) throw Object.assign(new Error(`Complete these items first: ${problems.join('; ')}`),{status:400});
    const officialForms=await prepareOfficialForms(storage,state,appeal,{allowIncomplete:preparationCopy,onMissing:message=>problems.push(message)}).catch(error=>{if(!preparationCopy)throw error;problems.push(error.message);return[];});
    const result=await PDFDocument.create();
    const font=await result.embedFont(StandardFonts.Helvetica);
    const docs=(state.documents || []).filter(d=>d.kind==='evidence' && (d.category!=='application' || (preparationCopy && !officialForms.some(form=>form.kind==='application'))));
    const total=docs.reduce((n,d)=>n+(d.size||0),0);
    if(total>25*1024*1024) throw Object.assign(new Error('Combined evidence exceeds 25 MB. Compress your files or ask the preparation desk for help.'),{status:400});
    let page,y;
    const fresh=()=>{page=result.addPage([612,792]);y=744;};
    // Standard PDF fonts cannot represent every Unicode character; fail rather than silently altering names.
    const line=(value,size=11)=>{
        for(const paragraph of String(value??'Not supplied').split('\n')) {
            let text='';
            for(const word of paragraph.split(/\s+/)) {
                if(font.widthOfTextAtSize(word,size)>510) {
                    for(const c of word) {if(font.widthOfTextAtSize(text+c,size)>510){draw(text,size);text='';}text+=c;}
                } else if(font.widthOfTextAtSize(`${text} ${word}`,size)>510){draw(text,size);text=word;}else text+=(text?' ':'')+word;
            }
            draw(text,size);
        }
    };
    const draw=(text,size)=>{if(!page||y<50)fresh();page.drawText(text,{x:50,y,size,font});y-=size+6;};
    const append=async doc=>{
        const object=await storage.get(doc.key);
        if(!object)throw Object.assign(new Error(`Missing uploaded file: ${doc.name}`),{status:400});
        const bytes=await object.arrayBuffer();
        try {
            if(doc.type==='application/pdf') {
                const source=await PDFDocument.load(bytes);
                if(source.getPageCount()>100 || result.getPageCount()+source.getPageCount()>150)throw new Error('Too many pages');
                // Preserve filled values in attachments when merging their pages.
                source.getForm().flatten();
                for(const p of await result.copyPages(source,source.getPageIndices()))result.addPage(p);
            } else {
                fresh(); line(`${doc.name}${doc.photoDate ? ` - photo date: ${doc.photoDate}`:''}`);
                const image=doc.type==='image/png'?await result.embedPng(bytes):await result.embedJpg(bytes);
                const fit=image.scale(Math.min(510/image.width,650/image.height));
                page.drawImage(image,{x:50,y:y-fit.height,width:fit.width,height:fit.height});
            }
        }catch {throw Object.assign(new Error(`Cannot assemble ${doc.name}. Use an unlocked, readable PDF (maximum 100 pages) or a JPG/PNG image. Signed digital PDFs should be retained separately as originals.`),{status:400});}
    };
    if(preparationCopy) {
        fresh();line('PREPARATION COPY - NOT READY TO FILE',16);
        line('Free copy of the information and supporting files collected so far. This is not an approved appeal packet and does not confirm a county filing.');
        line(`Property: ${appeal.property_address || state.propertySnapshot?.address || 'Not supplied'}`);
        line(`Assessment year: ${state.intake?.taxYear || state.taxYear || 'Not supplied'}`);
        if(problems.length){line('Still needed for the completed packet:',13);for(const problem of problems)line(`- ${problem}`);}
        else line('Review the complete packet and finish all required signatures before submission.');
    }
    for(const official of officialForms) {
        const source=await PDFDocument.load(official.bytes);
        for(const p of await result.copyPages(source,source.getPageIndices()))result.addPage(p);
    }
    fresh();line('Owner-prepared Assessor appeal supporting statement',16);
    const i=state.intake || {}, supplied=value=>value===undefined || value===null || value===''?'Not supplied':value;
    line(`Property: ${supplied(appeal.property_address || state.propertySnapshot?.address)}`);line(`PINs: ${supplied(i.pins || state.propertySnapshot?.pin)}`);line(`Assessment year: ${supplied(i.taxYear || state.taxYear)}`);
    line(`Owner: ${supplied(i.ownerName)}`);line(`Mailing address: ${supplied(i.mailingAddress)}`);
    line(`Requested fair market value: ${i.requestedMarketValue?'$'+Number(i.requestedMarketValue).toLocaleString('en-US'):'Not supplied'}`);
    line(`Grounds: ${supplied(i.reason)}`);line(supplied(i.explanation));
    if(i.recentSale) {line(`Purchase date: ${i.purchaseDate}`);line(`Purchase price: $${i.purchasePrice}`);line(`Seller: ${i.sellerName}`);line(`Buyer/seller relationship: ${i.saleRelationship}`);}
    line(i.ownerName?'The taxpayer selected the grounds, requested value and supporting evidence. Review and sign all applicable official forms before submitting.':'Owner instructions are not complete. Save your appeal information before preparing a filing packet.');
    if(state.propertySnapshot){fresh();line('Imported property record - owner review required',16);line(state.propertySnapshot.source);line(`Retrieved: ${state.propertySnapshot.capturedAt}`);
        const d=state.propertySnapshot.details || {};
        for(const key of ['townshipName','classCode','homeSize','yearBuilt','bedroomCount','bathroomCount','taxableValue','certifiedLand','certifiedBuilding','lastAppealYear'])line(`${key}: ${d[key]??'Not available'}`);
    }
    const comps=(state.propertySnapshot?.comparables||[]).filter(c=>i.selectedComparables?.includes(String(c.pin)));
    if(comps.length){fresh();line('Owner-selected assessment comparisons',16);line('Source: imported county records; verify assessment year and values. This is not an appraisal or a sale-price comparison.');
        for(const c of comps){line(`${c.address} | PIN ${c.pin}`);line(`Class ${c.classCode??'-'} | Area ${c.homeSize??'-'} sq ft | Year built ${c.yearBuilt??'-'} | Imported value ${c.taxableValue??'-'}`);}
    }
    fresh();line('Attachment index',16);
    for(const official of officialForms) {line(official.title);line(`Official source: ${official.sourceUrl}`);line(`Template revision: ${official.revision}`);}
    for(const doc of docs)line(`${doc.category || 'Evidence'}: ${doc.name}${doc.photoDate?` (photo date ${doc.photoDate})`:''}`);
    for(const doc of docs.filter(d=>d.category!=='application'))await append(doc);
    result.setTitle(`${i.taxYear || state.taxYear || ''} Assessor ${preparationCopy?'preparation copy - NOT READY TO FILE':'appeal'} - ${appeal.property_address || state.propertySnapshot?.address || ''}`);
    if(result.getPageCount()>150)throw Object.assign(new Error('The assembled packet exceeds 150 pages. Reduce attachments or contact the preparation desk.'),{status:400});
    const bytes=await result.save();
    if(bytes.length>15*1024*1024)throw Object.assign(new Error('Assembled packet exceeds 15 MB. Reduce attachment sizes.'),{status:400});
    return bytes;
}
