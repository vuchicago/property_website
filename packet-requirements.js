// Shared by the browser and server. Upload presence is not county acceptance.
import { singleFamilyEligibility } from './packet-scope.js?v=20261103-single-family';
export const OFFICIAL_FORM = 'https://www.cookcountyassessoril.gov/form-document/residential-appeal-form';
export const evidenceCategories = {
    application:'Official Assessor application — prepared for you', notice:'Assessment notice (only if needed to correct imported records)',
    photo:'Dated front photo of your property', comparisons:'Comparable evidence and photos',
    corrections:'Evidence of incorrect characteristics', sale:'Recent purchase / sale records',
    appraisal:'Existing appraisal report',
    condition:'Condition / damage evidence', affidavit:'Required affidavit or attestation', other:'Other supporting evidence'
};
export function requirements(state) {
    const p=state.intake || {}, docs=state.documents || [];
    const has=category=>docs.some(d=>d.kind==='evidence' && d.category===category);
    const rows=[
        {id:'application',title:evidenceCategories.application,detail:'We supply and prefill the official application from your saved property and confirmed information. You review it and sign where required; no blank-form download or upload is needed.',signature:'Owner signs the prepared application',done:true,providedBy:'service'},
        {id:'notice',title:'Property record and assessment summary — prepared for you',detail:'We include the saved property record. Confirm its year, PINs and values; upload a notice only when the imported record needs correction.',signature:'No new signature',done:Boolean(state.propertySnapshot?.details && p.recordsConfirmed) || has('notice'),providedBy:'service'},
    ];
    const add=(id,detail,signature='No routine new signature or notarization')=>rows.push({id,title:evidenceCategories[id],detail,signature,done:has(id)});
    if(!p.ownResidence) add('photo','A rental is not your own residence. Include the dated front color photo required by the Assessor. Check its date against the assessment lien date.');
    if(p.reason==='uniformity') rows.push({id:'comparisons',title:'Comparable properties and supporting records',detail:'Select at least three suitable properties or upload your own comparison exhibit. For a property you do not occupy, include required comparable front photos.',signature:'No routine new signature or notarization',done:(p.selectedComparables?.length>=3 || has('comparisons')) && (p.ownResidence || has('comparisons'))});
    if(p.reason==='overvaluation') rows.push({id:'market',title:'Market-value evidence',detail:'Provide sale records, a complete appraisal, or a supported market-comparison exhibit. Assessment comparisons alone do not establish sale value.',signature:'Preserve existing author certifications',done:has('sale')||has('appraisal')||has('comparisons')});
    if(p.reason==='characteristics') add('corrections','Upload measurements, plans, photos or other records supporting each requested correction.');
    if(p.recentSale) add('sale','Include applicable contract, closing statement, deed and transfer records for a sale within the agency lookback period.');
    if(p.appraisal) add('appraisal','Upload the complete existing report, including the appraiser certification and attachments.');
    if(p.damage) add('condition','Include dated photos and repair, inspection or other supporting records.');
    if(docs.some(d=>d.kind==='evidence'&&d.category==='photo'&&d.dateStamped!==true)) rows.push({id:'photo_attestation',title:'Photo-date attestation — prepared for you',detail:'We prefill the official attestation using the date you provide with your photo. Review and sign the facts; follow any notary block.',signature:'Owner signs; notarize only if the official form requires it',done:true,providedBy:'service'});
    if(p.affidavit) rows.push({id:'affidavit',title:'Requested attestation — prepared for you',detail:'We prefill the official form from the facts you provide. Complete any required signature or notarization.',signature:'Signer with knowledge; notarize where required',done:Boolean(p.attestationFacts),providedBy:'service'});
    return rows;
}
export function preparationProblems(state) {
    const p=state.intake || {};
    const problems=requirements(state).filter(r=>!r.done).map(r=>r.title);
    if(!p.requestedMarketValue || !p.pins || !p.recordsConfirmed) problems.unshift('Save your requested market value, PINs and record confirmation.');
    if(!p.singleFamilyScope || singleFamilyEligibility(state.propertySnapshot?.details).eligible===false || p.condo) problems.push('Confirm this is a single-family home with one dwelling unit.');
    if(p.recentSale && (!p.purchaseDate || !p.purchasePrice || !p.sellerName || !p.saleRelationship)) problems.push('Confirm the recent purchase date, price, seller and buyer/seller relationship.');
    return problems;
}
