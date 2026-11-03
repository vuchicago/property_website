export const CHECKED_ON = '2026-11-03';
export const SOURCES = {
    assessor: 'https://rpie.cookcountyassessor.com/official-appeal-rules-cook-county-assessor',
    board: 'https://www.cookcountyboardofreview.com/board-review-official-rules',
    forms: 'https://www.cookcountyassessoril.gov/forms',
    assessorPortal: 'https://www.cookcountyassessoril.gov/online-appeals',
    boardPortal: 'https://appeals.cookcountyboardofreview.com/',
    calendar: 'https://www.cookcountyassessoril.gov/assessment-calendar-and-deadlines',
    boardCalendar: 'https://www.cookcountyboardofreview.com/',
};
export const DEFAULT_PROFILE = { reason: 'uniformity', ownResidence: true, recentSale: false, saleDifference: false, appraisal: false, condo: false, rental: false, damage: false, affidavit: false };

export function checklist(agency, p = DEFAULT_PROFILE) {
    const board = agency === 'board_of_review';
    const source = board ? SOURCES.board : SOURCES.assessor;
    const row = (id, title, requirement, signature, notarization, detail, required = true, url = source) => ({id,title,requirement,signature,notarization,detail,required,url});
    const rows = [
        row('property','Property record and assessment notice','Preparation record','No new signature','No', 'Confirm ownership, class, township, assessment tax year, all related PINs, characteristics and existing filings. Keep a copy of the county record.'),
        row('deadline','Official filing and evidence dates','Required verification','No','No', board ? 'Record the Board’s complaint deadline and its separately announced evidence deadline.' : 'Confirm the township is open and record its appeal/evidence closing date. A local draft is not a filing.', true, board ? SOURCES.boardCalendar : SOURCES.calendar),
        row('complaint','Official appeal application / complaint','Required','Owner signs using the agency’s accepted method',board ? 'No notary block on the reviewed August 2026 Board complaint; separate affidavits may require a sworn certificate' : 'Check the current form; notarize any form that requires it', 'Use the current tax-year official form or portal. Include all related PINs. For a mailed DocuSign document, obtain agency acceptance first. This checklist is not the official complaint.', true, board ? SOURCES.boardPortal : SOURCES.assessorPortal),
        row('statement','Explanation and requested valuation',board ? 'Required brief under Rule 14' : 'Recommended explanatory statement; requested value required','Follow any signature block; owner confirms facts','Only if a required sworn form calls for it','Explain the assessment problem, requested value and evidence. Distinguish assessed value from market value; do not base the claim solely on a higher tax bill.'),
        row('photo','Front photograph of the property', board || !p.ownResidence ? 'Required' : 'Recommended for an individual appealing their own residence','No; date attestation may require signature','Photo: no; attestation: follow current form','Use an accurate color photo and record its date. Check agency photo timing requirements against the appeal year.',board || !p.ownResidence),
    ];
    if (p.reason !== 'characteristics') rows.push(row('comps','Comparable-property evidence', 'Evidence for the selected argument','No new signature on county data; sign any required accompanying form','No routine notarization','Include PINs, sourced assessment or sale data, relevant characteristics and an explanation of comparability. Check the agency’s current comparison requirements. Do not select only favorable properties.'));
    if (p.reason === 'characteristics') rows.push(row('corrections','Evidence of incorrect property characteristics','Required to support correction','Owner signs any required statement','Conditional on the form','Identify the exact error and provide measurements, plans, photographs or other records showing the correct facts.'));
    if (p.recentSale) rows.push(row('sale','Purchase and sale documentation','Conditional: recent sale or sale-price argument','Keep existing executed signatures; no routine re-signing','Not routinely re-notarized','Collect purchase agreement, closing statement, deed and relevant transfer records. Disclose price, date and buyer/seller relationship. Agency lookback periods differ.'));
    if (p.appraisal) rows.push(row('appraisal','Existing appraisal and valuation reports','Conditional: existing reports within agency lookback / appraisal argument','Appraiser’s signed certification; owner does not sign as appraiser','No routine additional notarization','Upload complete reports, including required photos, PINs and certification. Review disclosure requirements for other existing valuation reports. An app-generated comparison is not a licensed appraisal.'));
    if (p.condo) rows.push(row('condo','Individual condominium / townhome information','Conditional: unit appeal','Owner signs applicable unit forms','Conditional on the form','Confirm unit and parking PINs, unit facts, and association filings. Specify the individual unit scope. Check whether declaration, ownership percentages or building sales are needed; association-wide representation is outside this pilot.'));
    if (p.rental) rows.push(row('rental','Rental records and agency-specific financial forms','Conditional: rental or mixed use','Owner signs required business records','An affidavit may be needed for missing or combined returns','Review rental rules before proceeding: leases, tax schedules and income/expense records may be required. Class-specific exceptions differ. Do not treat this core residential checklist as a complete commercial appeal.'));
    if (p.damage) rows.push(row('condition','Condition, damage, vacancy or repair evidence','Conditional: condition-based claim','Owner signs required statements; authors sign their reports','Conditional affidavits','Collect dated photos and relevant estimates, inspection, fire, occupancy or repair records. Review the specific agency relief requirements.'));
    if (p.affidavit || p.saleDifference) rows.push(row('affidavit','Required affidavit / attestation','Conditional: facts or form require it','Person with knowledge signs','Required when the selected form requires a notarial act; verify before signing','Use the agency’s current form where provided. Significant sale/value differences can require a sale-circumstances affidavit. Ordinary DocuSign is not notarization.'));
    rows.push(row('review','Final signature, redaction and attachment review','Required review','Verify every required signature','Verify every applicable notarial certificate','Check current forms, attachment completeness, legibility, personal-data redaction, signatures and dates. Keep signed originals. A checkbox here records your review only.'));
    rows.push(row('submit','Submit through the official agency channel','Required filing step','Complete the portal’s certification or accepted paper signature','As required by the documents','Open the official portal, review and submit yourself. If mailing, verify current method, address, copies and timeliness rules. Save the complete submitted version.',true,board ? SOURCES.boardPortal : SOURCES.assessorPortal));
    return rows;
}

export function cleanProfile(value = {}) {
    const p = {...DEFAULT_PROFILE};
    if (!['uniformity','overvaluation','characteristics'].includes(value.reason)) throw new Error('Choose a valid appeal reason.');
    p.reason = value.reason;
    for (const key of Object.keys(p).filter(key => key !== 'reason')) {
        if (typeof value[key] !== 'boolean') throw new Error('Complete the property questions.');
        p[key] = value[key];
    }
    return p;
}
