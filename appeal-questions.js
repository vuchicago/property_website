import { requirements, preparationProblems, evidenceCategories } from './packet-requirements.js?v=20261103-market-report';
import { lowerValuationComparables, impliedMarketValue, MAX_APPEAL_COMPARISONS } from './packet-comparisons.js?v=20261103-market-report';

const esc=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uniformityDraft='I request review of my property assessment for uniformity. My selected comparable properties and supporting records are included for consideration.';
const field=(name,label,value='',type='text',extra='')=>`<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" required ${extra}></label>`;
const choices=(key,items)=>({key,items});
const money=value=>value==null?'Not available':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);

export function mountAppealQuestions(host,initial,callbacks) {
    let data=initial,answers={affidavit:false,...initial.state.intake,...initial.state.questionnaire?.answers};
    const allowedKeys=['ownerName','mailingAddress','ownerPhone','mailingCity','mailingState','mailingZip','propertyCity','propertyZip','pins','explanation','attestationFacts','purchaseDate','purchasePrice','sellerName','saleRelationship','reason','singleFamilyScope','recordsConfirmed','individualOwner','noExistingAppeal','ownResidence','recentSale','appraisal','damage','affidavit','requestedMarketValue','selectedComparables'];
    const cleanAnswers=()=>Object.fromEntries(allowedKeys.filter(key=>answers[key]!==undefined).map(key=>[key,answers[key]]));
    const snapshot=initial.state.propertySnapshot || {},details=snapshot.details || {};
    const comparisons=lowerValuationComparables(snapshot),allowedComparisons=new Set(comparisons.map(item=>String(item.pin)));
    answers.ownerName ||= details.mailingName || initial.appeal.customer_name || '';
    answers.mailingAddress ||= details.mailingAddress || '';
    answers.pins ||= snapshot.pin || initial.appeal.property_pin || '';
    answers.selectedComparables=Array.isArray(answers.selectedComparables)?answers.selectedComparables.filter(pin=>allowedComparisons.has(pin)).slice(0,MAX_APPEAL_COMPARISONS):comparisons.slice(0,MAX_APPEAL_COMPARISONS).map(item=>String(item.pin));
    let active=initial.state.questionnaire?.step || (initial.state.intake?.ownerName?'documents':'property');
    let photoReturnToReview=active==='evidence:photo' && Boolean(initial.state.intake?.ownerName);
    let busy=false,destroyed=false,hasSaved=false;
    const dialog=document.createElement('dialog');dialog.className='appeal-question-dialog';dialog.setAttribute('aria-labelledby','appeal-question-title');
    host.append(dialog);
    const projected=()=>({...data.state,intake:{...answers,taxYear:data.state.intake?.taxYear || data.state.taxYear}});
    const docRows=()=>requirements(projected()).filter(row=>!row.providedBy || (row.id==='notice' && !row.done && !data.state.propertySnapshot?.details));
    const steps=()=>{
        const list=['property','ownership','existing','occupancy'];
        if(answers.ownResidence===false && docRows().some(row=>row.id==='photo' && !row.done))list.push('evidence:photo');
        list.push('contact','mailing','reason','value');
        if(answers.reason==='uniformity')list.push('comparisons');
        list.push('statement','recent_sale');if(answers.recentSale)list.push('purchase');
        list.push('appraisal','condition');if(answers.affidavit)list.push('attestation');
        list.push('documents',...docRows().filter(row=>!row.done).map(row=>`evidence:${row.id}`),'review');return [...new Set(list)];
    };
    const taxYear=()=>data.state.intake?.taxYear || data.state.taxYear;
    const choiceMarkup=({key,items})=>`<div class="question-choices">${items.map(([value,title,note])=>`<button type="button" class="question-choice" data-choice="${key}" data-value="${esc(value)}" aria-pressed="${answers[key]===value}"><strong>${esc(title)}</strong>${note?`<span>${esc(note)}</span>`:''}</button>`).join('')}</div>`;
    function content() {
        const missing=data.officialForms?.flatMap(form=>form.missingValues || []) || [];
        const extra=[...new Map(missing.filter(item=>['mailingCity','mailingState','mailingZip','propertyCity','propertyZip'].includes(item.source)).map(item=>[item.source,item.label])).entries()];
        for(const key of ['mailingCity','mailingState','mailingZip','propertyCity','propertyZip'])if(answers[key]&&!extra.some(([name])=>name===key))extra.push([key,key.replace(/([A-Z])/g,' $1')]);
        const yesNo=(key,yes,no,note='')=>({choice:choices(key,[[true,yes],[false,no]]),note});
        const screens={
            property:{title:'Is this the home you want to appeal?',body:`<div class="question-property"><strong>${esc(snapshot.address || data.appeal.property_address)}</strong><p>Assessment year ${taxYear()} · ${esc(details.townshipName || 'Township will be verified')}</p><p>Single-family home · one dwelling unit</p><p>Implied market value ${money(impliedMarketValue(details.taxableValue))}</p></div><details ${!answers.pins?'open':''}><summary>Review or correct the PINs</summary>${field('pins','All property PINs',answers.pins)}</details>`,...yesNo('singleFamilyScope','Yes, this is my single-family home','No, choose a different property')},
            ownership:{title:'Is the property titled in your individual name?',...yesNo('individualOwner','Yes, in my individual name','No, another ownership type','This workflow is for individuals preparing their own single-family appeal.')},
            existing:{title:'Is anyone already handling this appeal?',...yesNo('noExistingAppeal','No, I am filing my own appeal','Yes, there is an existing appeal or representative')},
            occupancy:{title:'Do you live in this home?',...yesNo('ownResidence','Yes, this is my own residence','No, I do not live there','A rented single-family home is eligible. Occupancy determines which photos are needed.')},
            contact:{title:'How should the Assessor contact you?',note:'Review the owner details we already have. We use your verified account email.',body:`<p class="packet-muted">${esc(data.appeal.customer_email || '')}</p>${field('ownerName','Legal owner name',answers.ownerName)}${field('ownerPhone','Phone number',answers.ownerPhone,'tel')}`},
            mailing:{title:'What is your mailing address?',note:'This can be different from the property you are appealing.',body:field('mailingAddress','Mailing address',answers.mailingAddress)+extra.map(([name,label])=>field(name,label,answers[name])).join('')},
            reason:{title:'Why are you appealing?',choice:choices('reason',[['uniformity','Similar homes are assessed lower','Review a suggested comparison exhibit.'],['overvaluation','The estimated market value is too high','Use sale records, an existing appraisal or market evidence.'],['characteristics','The property details are incorrect','Tell us what is wrong and provide supporting records.']])},
            value:{title:'What market value are you requesting?',note:`Your current implied market value is ${money(impliedMarketValue(details.taxableValue))}. Use fair market value, not the assessed value. You choose the requested amount.`,body:field('requestedMarketValue','Requested fair market value ($)',answers.requestedMarketValue,'number','min="1" max="10000000000" step="0.01"')},
            comparisons:{title:'Review your suggested comparisons',note:`Your property's implied market value is ${money(impliedMarketValue(details.taxableValue))}. We suggest up to five similar properties with lower assessed values. Keep at least three or supply your own comparison exhibit.`,body:(comparisons.map((item,index)=>`<label class="question-comparison" ${index>=5?'data-more-comparison hidden':''}><input type="checkbox" name="selectedComparables" value="${esc(item.pin)}" ${answers.selectedComparables.includes(String(item.pin))?'checked':''}><span><strong>${esc(item.address)}</strong><small>Implied market value ${money(impliedMarketValue(item.taxableValue))} · PIN ${esc(item.pin)} · ${esc(item.homeSize ?? '?')} sq ft · built ${esc(item.yearBuilt ?? '?')}</small></span></label>`).join('') || '<p>No comparisons with a lower assessed value are available. You can upload your own comparison exhibit in the evidence cards.</p>')+(comparisons.length>5?'<button type="button" class="btn btn-secondary" id="question-more-comparisons">Show more comparisons</button>':'')+'<p class="packet-muted">Implied market value = assessed value ÷ 0.10. These are assessment comparisons, not sale prices. Review similarity and any meaningful differences; lower value alone does not establish comparability.</p>'},
            statement:{title:answers.reason==='characteristics'?'What needs to be corrected?':'What would you like the Assessor to know?',note:answers.reason==='uniformity'?'We drafted a short statement. Keep it or add facts you want considered.':'Describe the facts that support your requested value.',body:`<label>Your statement<textarea name="explanation" required maxlength="10000">${esc(answers.explanation)}</textarea></label><button type="button" class="question-text-button" id="question-add-attestation">The Assessor requested an additional attestation</button>`},
            recent_sale:{title:'Does a recent purchase apply?',...yesNo('recentSale','Yes, there was a recent purchase or I rely on a sale','No, neither applies',`Disclose purchases within two years before January 1, ${taxYear()}, or a sale you rely on for this appeal.`)},
            purchase:{title:'Tell us about the purchase',body:field('purchaseDate','Purchase date',answers.purchaseDate,'date')+field('purchasePrice','Purchase price ($)',answers.purchasePrice,'number','min="1" step="0.01"')+field('sellerName','Seller name',answers.sellerName)+field('saleRelationship','Relationship between buyer and seller (or none)',answers.saleRelationship)},
            appraisal:{title:'Do you have an existing appraisal to disclose?',...yesNo('appraisal','Yes, I have an applicable appraisal or valuation report','No, I do not',`Include applicable reports prepared within two years before January 1, ${taxYear()}. You do not need to buy an appraisal for this workflow.`)},
            condition:{title:'Does your argument rely on damage or condition?',...yesNo('damage','Yes, condition, damage or vacancy is part of my argument','No, my appeal does not rely on this')},
            attestation:{title:'What facts did the Assessor ask you to attest?',body:`<label>Requested facts<textarea name="attestationFacts" required maxlength="10000">${esc(answers.attestationFacts)}</textarea></label><p>We prepare the applicable official form. You review and sign it and arrange notarization only if required.</p>`},
            documents:{title:'Now add only the evidence that applies',note:'We supply the official forms, property summary and comparison exhibit. You only provide documents we cannot supply.',body:`<ul class="question-document-list">${docRows().map(row=>`<li>${row.done?'Added':'Needed'} · ${esc(row.title)}</li>`).join('') || '<li>No additional personal evidence is listed for these answers.</li>'}</ul><p>Questions are saved before uploading. You can skip an upload for now and still download a preparation copy.</p>`},
            review:{title:'Your packet is ready to review',body:reviewMarkup()}
        };
        if(active.startsWith('evidence:')) {
            const id=active.slice(9),row=docRows().find(item=>item.id===id);
            const category=id==='market'?'comparisons':id;
            return {title:row?.title || evidenceCategories[category] || 'Supporting evidence',note:row?.detail,upload:category,body:`${row?.done?'<p class="question-added">A document for this item is already saved. You can continue or add another file.</p>':''}${id==='market'?'<label>Evidence type<select name="evidenceCategory"><option value="comparisons">Market-comparison exhibit</option><option value="sale">Sale records</option><option value="appraisal">Existing appraisal</option></select></label>':''}<label>PDF, JPG or PNG<input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png"></label>${category==='photo'?'<label>Date this photo was taken<input name="photoDate" type="date"></label><label class="question-inline"><input name="photoDateStamped" type="checkbox">The photo visibly shows its date.</label><p class="packet-muted">If needed, we append a photo-date attestation for you to sign.</p>':''}<p class="packet-muted">Maximum 15 MB. Remove Social Security and financial account numbers before uploading.</p>`,skip:true};
        }
        return screens[active] || screens.property;
    }
    function reviewMarkup() {
        const reason={uniformity:'Similar properties',overvaluation:'Market value',characteristics:'Property details'}[answers.reason] || '';
        const forms=data.officialForms || [],pending=!forms.length || forms.some(form=>!form.ready || form.missingValues?.length);
        const incomplete=preparationProblems(projected());
        return `<dl class="question-review">${[['Property',snapshot.address || data.appeal.property_address,'property'],['Owner',answers.ownerName,'contact'],['Grounds',reason,'reason'],['Requested value',Number(answers.requestedMarketValue).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}),'value']].map(([label,value,step])=>`<div><dt>${label}</dt><dd>${esc(value)} <button type="button" class="question-text-button" data-edit-step="${step}">Edit</button></dd></div>`).join('')}</dl><h3>Documents to review and sign</h3><ul>${forms.map(form=>`<li>${esc(form.title)}${form.ready?' — included when complete':' — preparation desk is obtaining it'}</li>`).join('') || '<li>Official Assessor application — supplied by the preparation desk</li>'}</ul><p>Applicable official forms are appended to the PDF with signature blocks left for you. Standard DocuSign does not notarize.</p>${pending?'<p class="question-notice">Official form setup is still in progress. You can download your preparation copy now; its cover lists missing items and marks it not ready to file.</p>':''}${incomplete.length?`<details><summary>Still needed for a filing packet</summary><ul>${incomplete.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></details>`:''}${docRows().some(row=>row.id==='photo' && !row.done)?'<p><button type="button" class="question-text-button" data-edit-step="evidence:photo">Add your property photo and date</button></p>':''}<button type="button" class="btn btn-primary" id="${!pending && !incomplete.length?'question-build':'question-download'}">Download PDF</button><p class="packet-muted">Downloads are free. Payment is only for optional signing, printing and mailing.</p>`;
    }
    function collect() {
        for(const el of dialog.querySelectorAll('[name]')) {
            if(['file','photoDate','photoDateStamped','selectedComparables','evidenceCategory'].includes(el.name))continue;
            answers[el.name]=el.type==='number'?(el.value===''?'':Number(el.value)):el.value;
        }
        if(active==='comparisons')answers.selectedComparables=[...dialog.querySelectorAll('[name="selectedComparables"]:checked')].map(el=>el.value);
    }
    const error=text=>{const el=dialog.querySelector('#question-error');if(el){el.textContent=text;el.focus();}};
    async function task(action) {
        if(busy)return;busy=true;dialog.setAttribute('aria-busy','true');for(const button of dialog.querySelectorAll('button,input,select,textarea'))button.disabled=true;
        try{await action();}catch(cause){error(cause.message || 'Could not save. Your answers are kept on this card. Try again.');}
        finally{busy=false;dialog.removeAttribute('aria-busy');for(const button of dialog.querySelectorAll('button,input,select,textarea'))button.disabled=false;}
    }
    async function persist(step) {await callbacks.saveDraft(cleanAnswers(),step);}
    async function advance() {
        const screen=content();collect();
        if(!dialog.querySelector('form').reportValidity())return;
        if(['property','ownership','existing'].includes(active) && answers[screen.choice.key]!==true){error('This workflow needs the confirmed property, individual ownership and no conflicting appeal. Choose another answer or return to My account.');return;}
        if(active==='property' && !String(answers.pins).split(/[,;\n]+/).every(pin=>/^\d{14}$/.test(pin.replace(/[-\s]/g,'')))){error('Confirm each 14-digit property PIN before continuing.');return;}
        const list=steps(),following=list.slice(list.indexOf(active)+1);
        await task(async()=>{
            if(active==='condition' || (active==='attestation')) {data=await callbacks.saveIntake(cleanAnswers());hasSaved=true;}
            if(screen.upload) {
                const file=dialog.querySelector('[name="file"]').files[0];
                if(!file)throw new Error('Choose a file, or select Skip for now to finish this item later.');
                if(file) {
                    if(file.size>15*1024*1024)throw new Error('Choose a file of at most 15 MB.');
                    const photoDate=dialog.querySelector('[name="photoDate"]')?.value;
                    if(screen.upload==='photo' && !photoDate)throw new Error('Enter the date the photo was taken.');
                    data=await callbacks.upload({category:dialog.querySelector('[name="evidenceCategory"]')?.value || screen.upload,file,photoDate,photoDateStamped:dialog.querySelector('[name="photoDateStamped"]')?.checked || false});
                }
            }
            const next=screen.upload==='photo' && photoReturnToReview?'review':following.find(step=>steps().includes(step)) || 'review';
            await persist(next);photoReturnToReview=false;active=next;render();
        });
    }
    function render() {
        if(destroyed)return;
        const list=steps();if(!list.includes(active))active=active.startsWith('evidence:')?'documents':'property';
        if(active==='statement' && !answers.explanation && answers.reason==='uniformity')answers.explanation=uniformityDraft;
        const screen=content(),index=list.indexOf(active);
        dialog.innerHTML=`<form novalidate><header class="question-header"><span>Prepare your appeal</span><button type="button" class="question-close" aria-label="Save and close questions">×</button></header><div class="question-progress"><span>Card ${index+1} of ${list.length}</span><progress value="${index+1}" max="${list.length}" aria-label="Question progress"></progress></div><div class="question-body"><h2 id="appeal-question-title" tabindex="-1">${esc(screen.title)}</h2>${screen.note?`<p class="question-description">${esc(screen.note)}</p>`:''}${screen.body || ''}${screen.choice?choiceMarkup(screen.choice):''}<p id="question-error" role="alert" tabindex="-1"></p></div><footer class="question-footer"><button type="button" class="btn btn-secondary" id="question-back" ${index===0?'hidden':''}>Back</button><span>Saved to your account as you continue</span>${active==='review'?'<button type="button" class="btn btn-secondary" id="question-done">Save and close</button>':screen.choice?'':`<button type="submit" class="btn btn-primary">${screen.upload?'Save and continue':'Continue'}</button>`}${screen.skip?'<button type="button" class="question-text-button" id="question-skip">Skip for now</button>':''}</footer></form>`;
        dialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();void advance();});
        dialog.querySelector('.question-close').onclick=()=>void close();
        dialog.querySelector('#question-done')?.addEventListener('click',()=>void close());
        dialog.querySelector('#question-back')?.addEventListener('click',()=>void task(async()=>{collect();const previous=list[index-1];await persist(previous);photoReturnToReview=false;active=previous;render();}));
        for(const button of dialog.querySelectorAll('[data-choice]'))button.onclick=()=>{
            const key=button.dataset.choice,raw=button.dataset.value,previousReason=answers.reason;answers[key]=raw==='true'?true:raw==='false'?false:raw;
            if(key==='singleFamilyScope' && answers[key]===false){void task(async()=>{collect();await persist('property');dialog.close();callbacks.chooseProperty();});return;}
            if(key==='singleFamilyScope' && answers[key])answers.recordsConfirmed=true;
            if(key==='reason' && answers.reason!=='uniformity' && answers.explanation===uniformityDraft)answers.explanation='';
            if(key==='reason' && answers.reason!=='uniformity')answers.selectedComparables=[];
            if(key==='reason' && answers.reason==='uniformity' && previousReason && previousReason!=='uniformity')answers.selectedComparables=comparisons.slice(0,5).map(item=>String(item.pin));
            if(key==='recentSale' && !answers.recentSale)for(const field of ['purchaseDate','purchasePrice','sellerName','saleRelationship'])delete answers[field];
            void advance();
        };
        dialog.querySelector('#question-skip')?.addEventListener('click',()=>void task(async()=>{const next=photoReturnToReview?'review':list[index+1] || 'review';await persist(next);photoReturnToReview=false;active=next;render();}));
        dialog.querySelector('#question-more-comparisons')?.addEventListener('click',event=>{for(const row of dialog.querySelectorAll('[data-more-comparison]'))row.hidden=false;event.currentTarget.hidden=true;});
        for(const box of dialog.querySelectorAll('[name="selectedComparables"]'))box.addEventListener('change',()=>{if(dialog.querySelectorAll('[name="selectedComparables"]:checked').length>MAX_APPEAL_COMPARISONS){box.checked=false;error('Choose up to five comparisons. Uncheck one before choosing another.');}});
        dialog.querySelector('#question-add-attestation')?.addEventListener('click',()=>{answers.affidavit=true;error('An attestation-facts card has been added. The preparation desk supplies the official form.');});
        for(const button of dialog.querySelectorAll('[data-edit-step]'))button.onclick=()=>{photoReturnToReview=active==='review' && button.dataset.editStep==='evidence:photo';active=button.dataset.editStep;render();};
        dialog.querySelector('#question-download')?.addEventListener('click',()=>void task(async()=>{if(!hasSaved){data=await callbacks.saveIntake(cleanAnswers());hasSaved=true;}await callbacks.download();}));
        dialog.querySelector('#question-build')?.addEventListener('click',()=>void task(async()=>{data=await callbacks.saveIntake(cleanAnswers());await callbacks.generate();destroy();callbacks.finish();}));
        queueMicrotask(()=>{if(!destroyed && dialog.open){dialog.querySelector('#appeal-question-title')?.focus();dialog.querySelector('.question-body')?.scrollTo(0,0);}});
    }
    async function close() {if(busy)return;collect();await task(async()=>{await persist(active);dialog.close();callbacks.finish();});}
    dialog.addEventListener('cancel',event=>{event.preventDefault();void close();});
    function destroy(){destroyed=true;dialog.close();dialog.remove();}
    return {open(){render();dialog.showModal();dialog.querySelector('#appeal-question-title')?.focus();},destroy};
}
