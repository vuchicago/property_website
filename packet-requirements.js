// Shared by the browser and server. Upload presence is not county acceptance.
export const OFFICIAL_FORM = 'https://www.cookcountyassessoril.gov/form-document/residential-appeal-form';
export const evidenceCategories = {
    application:'Completed official Assessor application', notice:'Current assessment notice / property record',
    photo:'Dated front photo of your property', comparisons:'Comparable evidence and photos',
    corrections:'Evidence of incorrect characteristics', sale:'Recent purchase / sale records',
    appraisal:'Existing appraisal report', condo:'Unit and related PIN records',
    condition:'Condition / damage evidence', affidavit:'Required affidavit or attestation', other:'Other supporting evidence'
};
export function requirements(state) {
    const p=state.intake || {}, docs=state.documents || [];
    const has=category=>docs.some(d=>d.kind==='evidence' && d.category===category);
    const rows=[
        {id:'application',title:evidenceCategories.application,detail:'Download the current official form, complete every applicable field, and upload the PDF. Leave signatures for your chosen submission method. Check every signature and notary block.',signature:'Owner signature; follow any notary block',done:has('application')},
        {id:'notice',title:evidenceCategories.notice,detail:'Confirm assessment year, all PINs, township, class and current values against this record.',signature:'No new signature',done:has('notice')},
    ];
    const add=(id,detail,signature='No routine new signature or notarization')=>rows.push({id,title:evidenceCategories[id],detail,signature,done:has(id)});
    if(!p.ownResidence) add('photo','A rental is not your own residence. Include the dated front color photo required by the Assessor. Check its date against the assessment lien date.');
    if(p.reason==='uniformity') rows.push({id:'comparisons',title:'Comparable properties and supporting records',detail:'Select at least three suitable properties or upload your own comparison exhibit. For a property you do not occupy, include required comparable front photos.',signature:'No routine new signature or notarization',done:(p.selectedComparables?.length>=3 || has('comparisons')) && (p.ownResidence || has('comparisons'))});
    if(p.reason==='overvaluation') rows.push({id:'market',title:'Market-value evidence',detail:'Provide sale records, a complete appraisal, or a supported market-comparison exhibit. Assessment comparisons alone do not establish sale value.',signature:'Preserve existing author certifications',done:has('sale')||has('appraisal')||has('comparisons')});
    if(p.reason==='characteristics') add('corrections','Upload measurements, plans, photos or other records supporting each requested correction.');
    if(p.recentSale) add('sale','Include applicable contract, closing statement, deed and transfer records for a sale within the agency lookback period.');
    if(p.appraisal) add('appraisal','Upload the complete existing report, including the appraiser certification and attachments.');
    if(p.condo) add('condo','Include unit and parking PINs and applicable unit / ownership documents.');
    if(p.damage) add('condition','Include dated photos and repair, inspection or other supporting records.');
    if(p.affidavit) add('affidavit','Use the required official attestation. Arrange notarization if the form requires it; ordinary DocuSign does not notarize it.','Signer with knowledge; notarize where required');
    return rows;
}
export function preparationProblems(state) {
    const p=state.intake || {};
    const problems=requirements(state).filter(r=>!r.done).map(r=>r.title);
    if(!p.requestedMarketValue || !p.pins || !p.filingDeadline || !p.recordsConfirmed) problems.unshift('Save your requested market value, PINs, verified deadline and record confirmation.');
    if(!p.residentialScope) problems.push('Confirm this is residential property with no more than six units.');
    if(!p.documentsReviewed) problems.push('Review the applicable forms, attachment contents and signature / notary requirements.');
    return problems;
}
