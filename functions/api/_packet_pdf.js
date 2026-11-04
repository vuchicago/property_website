import { PDFDocument, StandardFonts, rgb } from '../../assets/vendor/pdf-lib.esm.min.js';
import { preparationProblems } from '../../packet-requirements.js';
import { prepareOfficialForms } from './_official_forms.js';
import { singleFamilyEligibility } from '../../packet-scope.js';
import { selectedAppealComparables, impliedMarketValue, impliedMarketValuePerSqft, RESIDENTIAL_ASSESSMENT_RATIO } from '../../packet-comparisons.js';

export async function assemblePacket(state, appeal, storage, {preparationCopy=false}={}) {
    if(preparationCopy && state.questionnaire?.answers)state={...state,intake:{...state.intake,...state.questionnaire.answers,taxYear:state.intake?.taxYear || state.taxYear}};
    const problems=preparationProblems(state);
    if(singleFamilyEligibility(state.propertySnapshot?.details).eligible===false)throw Object.assign(new Error('Preparation downloads currently support single-family homes only.'),{status:400});
    if(!preparationCopy && problems.length) throw Object.assign(new Error(`Complete these items first: ${problems.join('; ')}`),{status:400});
    const officialForms=await prepareOfficialForms(storage,state,appeal,{allowIncomplete:preparationCopy,onMissing:message=>problems.push(message)}).catch(error=>{if(!preparationCopy)throw error;problems.push(error.message);return[];});
    const result=await PDFDocument.create();
    const font=await result.embedFont(StandardFonts.Helvetica);
    const bold=await result.embedFont(StandardFonts.HelveticaBold);
    const ink=rgb(.12,.22,.19),muted=rgb(.32,.38,.35),rule=rgb(.80,.85,.82),tint=rgb(.94,.97,.95);
    const generatedPages=[],officialIndex=[],evidenceIndex=[];
    const money=(value,digits=0)=>value==null?'Not available':Number(value).toLocaleString('en-US',{style:'currency',currency:'USD',minimumFractionDigits:digits,maximumFractionDigits:digits});
    const supplied=value=>value===undefined || value===null || value===''?'Not supplied':String(value);
    const i=state.intake || {},snapshot=state.propertySnapshot || {},details=snapshot.details || {};
    const subjectPin=i.pins || snapshot.pin || appeal.property_pin || 'Not supplied',year=i.taxYear || state.taxYear || 'Not supplied';
    const docs=(state.documents || []).filter(d=>d.kind==='evidence' && (d.category!=='application' || (preparationCopy && !officialForms.some(form=>form.kind==='application'))));
    const total=docs.reduce((n,d)=>n+(d.size||0),0);
    if(total>25*1024*1024) throw Object.assign(new Error('Combined evidence exceeds 25 MB. Compress your files or ask the preparation desk for help.'),{status:400});
    let page,y;
    const fresh=(landscape=false)=>{page=result.addPage(landscape?[792,612]:[612,792]);y=page.getHeight()-48;generatedPages.push(page);page.drawRectangle({x:0,y:page.getHeight()-12,width:page.getWidth(),height:12,color:ink});};
    // Standard PDF fonts cannot represent every Unicode character; fail rather than silently altering names.
    const line=(value,size=10,face=font,color=ink)=>{
        if(!page)fresh();
        const width=page.getWidth()-96;
        for(const paragraph of String(value??'Not supplied').split('\n')) {
            let text='';
            for(const word of paragraph.split(/\s+/)) {
                if(face.widthOfTextAtSize(word,size)>width) {
                    if(text){draw(text,size,face,color);text='';}
                    for(const c of word) {if(face.widthOfTextAtSize(text+c,size)>width){draw(text,size,face,color);text='';}text+=c;}
                } else if(face.widthOfTextAtSize(`${text} ${word}`,size)>width){draw(text,size,face,color);text=word;}else text+=(text?' ':'')+word;
            }
            draw(text,size,face,color);
        }
    };
    const draw=(text,size,face=font,color=ink)=>{if(!page||y<58)fresh(page?.getWidth()===792);page.drawText(text,{x:48,y,size,font:face,color});y-=size+6;};
    const heading=(title,subtitle)=>{line(title,18,bold);if(subtitle)line(subtitle,9,font,muted);y-=8;};
    const label=(name,value)=>line(`${name}: ${supplied(value)}`);
    const pageLabel=(start,end)=>start===end?`Page ${start}`:`Pages ${start}-${end}`;
    const wrapCell=(value,width,size,face)=>{
        const lines=[];let text='';
        for(const paragraph of supplied(value).split('\n')) {
            for(const word of paragraph.split(/\s+/)) {
                if(face.widthOfTextAtSize(word,size)>width) {
                    if(text){lines.push(text);text='';}
                    for(const char of word){if(face.widthOfTextAtSize(text+char,size)>width){lines.push(text);text='';}text+=char;}
                }else if(text && face.widthOfTextAtSize(`${text} ${word}`,size)>width){lines.push(text);text=word;}else text+=(text?' ':'')+word;
            }
            lines.push(text);text='';
        }
        return lines;
    };
    const comparisonGrid=comps=>{
        fresh(true);heading('Exhibit B - comparison grid','Subject property and up to five owner-selected assessment comparisons');
        const properties=[{...details,pin:subjectPin,address:appeal.property_address || snapshot.address},...comps];
        const widths=[120,...properties.map(()=>(page.getWidth()-216)/properties.length)];
        const row=(cells,header=false)=>{
            const size=8.5,lines=cells.map((cell,n)=>wrapCell(cell,widths[n]-12,size,header||n===0?bold:font));
            const height=Math.max(...lines.map(cell=>cell.length))*11+14;
            if(y-height<55){fresh(true);heading('Comparison exhibit - continued',`Assessment year ${year}`);}
            let x=48;
            lines.forEach((cell,n)=>{page.drawRectangle({x,y:y-height,width:widths[n],height,borderWidth:.5,borderColor:rule,color:header||n===1?tint:rgb(1,1,1)});cell.forEach((text,k)=>page.drawText(text,{x:x+6,y:y-14-k*11,size,font:header||n===0?bold:font,color:ink}));x+=widths[n];});
            y-=height;
        };
        row(['Property','Subject',...comps.map((_,n)=>`Comp ${n+1}`)],true);
        const subjectValue=impliedMarketValue(details.taxableValue);
        for(const [name,value] of [
            ['Address',p=>p.address],['PIN',p=>p.pin],['Township / neighborhood',p=>`${p.townshipName || 'Not available'} / ${p.neighborhoodCode || 'Not available'}`],
            ['Property class',p=>p.classCode],['Building area (sq ft)',p=>p.homeSize],['Year built',p=>p.yearBuilt],['Bedrooms / bathrooms',p=>`${p.bedroomCount ?? '-'} / ${p.bathroomCount ?? '-'}`],['Construction',p=>p.masonryType],
            ['Implied market value',p=>money(impliedMarketValue(p.taxableValue))],['Implied value / sq ft',p=>money(impliedMarketValuePerSqft(p),2)],
            ['Below subject value',p=>p===properties[0]?'Reference':`${((1-impliedMarketValue(p.taxableValue)/subjectValue)*100).toFixed(1)}%`]
        ])row([name,...properties.map(value)]);
        y-=12;
        line('Calculation: implied market value = assessed value / 0.10 (Class 2 residential).',9);
        line('Selection: lower assessed values only, retaining the imported similarity ranking. This filtered set is not a complete market survey or evidence of sale prices. No appraisal adjustments are made.',9);
        line('Verify the assessment year and characteristics, including land area, against current county records. Supply any required dated subject/comparable photos in the supporting evidence.',9);
    };
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
        const start=result.getPageCount()+1;
        const source=await PDFDocument.load(official.bytes);
        for(const p of await result.copyPages(source,source.getPageIndices()))result.addPage(p);
        officialIndex.push({...official,start,end:result.getPageCount()});
    }
    fresh();heading('Residential Assessor appeal',`Owner-prepared supporting statement | Assessment year ${year}`);
    label('Property',appeal.property_address || snapshot.address);label('PINs',subjectPin);label('Township',details.townshipName);
    label('Owner',i.ownerName);label('Account email',appeal.customer_email);label('Phone',i.ownerPhone);label('Mailing address',[i.mailingAddress,i.mailingCity,i.mailingState,i.mailingZip].filter(Boolean).join(', '));
    y-=8;line('Requested relief',12,bold);
    label('Current implied market value',money(impliedMarketValue(details.taxableValue)));
    label('Requested fair market value',i.requestedMarketValue?money(i.requestedMarketValue):'Not supplied');
    label('Requested assessed value (10%)',i.requestedMarketValue?money(i.requestedMarketValue*RESIDENTIAL_ASSESSMENT_RATIO):'Not supplied');
    label('Grounds',({uniformity:'Lack of uniformity',overvaluation:'Overvaluation',characteristics:'Incorrect property characteristics'})[i.reason] || i.reason);
    y-=8;line('Owner statement',12,bold);line(supplied(i.explanation));
    if(i.recentSale) {line(`Purchase date: ${i.purchaseDate}`);line(`Purchase price: $${i.purchasePrice}`);line(`Seller: ${i.sellerName}`);line(`Buyer/seller relationship: ${i.saleRelationship}`);}
    line(i.ownerName?'The taxpayer selected the grounds, requested value and supporting evidence. Review and sign all applicable official forms before submitting.':'Owner instructions are not complete. Save your appeal information before preparing a filing packet.');
    if(state.propertySnapshot){fresh();heading('Exhibit A - subject property record','Imported county record | Owner review required');
        for(const [name,value] of [['Property',snapshot.address || appeal.property_address],['PINs',subjectPin],['Assessment year of appeal',year],['Township',details.townshipName],['Neighborhood code',details.neighborhoodCode],['Property class',details.classCode],['Building area (sq ft)',details.homeSize],['Year built',details.yearBuilt],['Bedrooms',details.bedroomCount],['Bathrooms',details.bathroomCount],['Construction',details.masonryType],['Last appeal year',details.lastAppealYear]])label(name,value);
        y-=8;line('Implied market value',12,bold);line(money(impliedMarketValue(details.taxableValue)),18,bold);
        line('Class 2 residential: assessed value divided by 0.10. This is an assessment-derived estimate, not a sale price or independent appraisal.',9);
        label('Implied market value per building sq ft',money(impliedMarketValuePerSqft(details),2));
        y-=8;line('Record provenance',12,bold);line(snapshot.source || 'Imported Cook County property records.',9);label('Record captured',snapshot.capturedAt);
        line('The imported valuation year is not certified. Confirm this record against the current county notice and property details before filing.',9);
        line('Method reference: https://www.cookcountyassessoril.gov/how-residential-property-valued-0',8);
    }
    const comps=selectedAppealComparables(state);
    if(comps.length)comparisonGrid(comps);
    fresh();heading('Attachment index and signature review','Official forms and supporting evidence included in this PDF');
    for(const official of officialIndex) {line(`${pageLabel(official.start,official.end)} - ${official.title}`,10,bold);line(`Official source: ${official.sourceUrl}`,8);line(`Template revision: ${official.revision}`,8);line('Review and complete every signature block. Follow any notarization instructions on the official form.',9);}
    if(!officialIndex.length)line('Official forms are not included yet. This preparation copy is not ready to file.');
    y-=8;line('Supporting attachments',12,bold);
    for(const doc of docs.filter(d=>d.category!=='application')) {
        line(`${doc.category || 'Evidence'}: ${doc.name}${doc.photoDate?` (photo date ${doc.photoDate})`:''}`,10,bold);
        if(y<65)fresh();
        evidenceIndex.push({doc,page,y});y-=20;
    }
    if(!evidenceIndex.length)line('No supporting files uploaded.');
    for(const entry of evidenceIndex) {const start=result.getPageCount()+1;await append(entry.doc);entry.page.drawText(pageLabel(start,result.getPageCount()),{x:48,y:entry.y,size:9,font,color:muted});}
    const pageCount=result.getPageCount();
    for(const generated of generatedPages) {
        const number=result.getPages().indexOf(generated)+1;
        generated.drawLine({start:{x:48,y:36},end:{x:generated.getWidth()-48,y:36},thickness:.5,color:rule});
        generated.drawText(`Assessor appeal | ${year} | ${preparationCopy?'PREPARATION COPY - NOT READY TO FILE':'Owner-prepared evidence'}`,{x:48,y:23,size:8,font,color:muted});
        const footer=`${number} / ${pageCount}`;generated.drawText(footer,{x:generated.getWidth()-48-font.widthOfTextAtSize(footer,8),y:23,size:8,font,color:muted});
    }
    result.setTitle(`${i.taxYear || state.taxYear || ''} Assessor ${preparationCopy?'preparation copy - NOT READY TO FILE':'appeal'} - ${appeal.property_address || state.propertySnapshot?.address || ''}`);
    if(result.getPageCount()>150)throw Object.assign(new Error('The assembled packet exceeds 150 pages. Reduce attachments or contact the preparation desk.'),{status:400});
    const bytes=await result.save();
    if(bytes.length>15*1024*1024)throw Object.assign(new Error('Assembled packet exceeds 15 MB. Reduce attachment sizes.'),{status:400});
    return bytes;
}
