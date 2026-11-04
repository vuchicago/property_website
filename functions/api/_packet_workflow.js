import { requireOpenMailingWindow } from './_packet_mailing.js';
import { singleFamilyEligibility } from '../../packet-scope.js';

export const initialPacket = () => ({ status: 'intake', version: 0, documents: [] });

function requireCondition(value, message) {
    if (!value) throw Object.assign(new Error(message), { status: 400 });
}
function field(value, label, max = 1000) {
    requireCondition(typeof value === 'string' && value.trim() && value.length <= max, `${label} is required (maximum ${max} characters).`);
    return value.trim();
}
function date(value, label) {
    const parsed = new Date(value);
    requireCondition(/^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value, `${label} must be a valid date.`);
    return value;
}

// Pure transition rules shared by the API and tests. Files are private R2 objects.
export function transitionPacket(current, input, actor, now = new Date().toISOString()) {
    const next = structuredClone(current);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
    const admin = () => requireCondition(actor.isAdmin, 'Only an administrator can perform this action.');
    const owner = () => requireCondition(actor.isOwner, 'Only the property account owner can perform this action.');
    const at = (...statuses) => requireCondition(statuses.includes(current.status), 'This action is not available at the current stage. Refresh the packet.');
    const artifact = (kind) => {
        const doc = input.document;
        requireCondition(doc?.id && doc.kind === kind && doc.version === current.version, `Upload the ${kind.replaceAll('_', ' ')} for this packet version.`);
        requireCondition(next.documents.length < 50, 'This case has reached its 50-document limit.');
        next.documents.push(doc);
        return doc.id;
    };
    switch (input.action) {
        case 'questionnaire': {
            owner(); at('intake','preparing');
            requireCondition(input.answers && typeof input.answers==='object' && !Array.isArray(input.answers),'Provide questionnaire answers.');
            const strings={ownerName:200,mailingAddress:1000,ownerPhone:300,mailingCity:300,mailingState:300,mailingZip:300,propertyCity:300,propertyZip:300,pins:500,explanation:10000,attestationFacts:10000,purchaseDate:300,sellerName:300,saleRelationship:300,reason:40};
            const booleans=new Set(['singleFamilyScope','recordsConfirmed','individualOwner','noExistingAppeal','ownResidence','recentSale','appraisal','damage','affidavit']);
            const answers={};
            for(const [key,value] of Object.entries(input.answers)) {
                if(Object.hasOwn(strings,key)) {requireCondition(typeof value==='string' && value.length<=strings[key],'Answer is too long or invalid.');answers[key]=value;}
                else if(booleans.has(key)) {requireCondition(typeof value==='boolean','Choose yes or no.');answers[key]=value;}
                else if(['requestedMarketValue','purchasePrice'].includes(key)) {requireCondition(value==='' || (Number.isFinite(value) && value>=0 && value<=1e10),'Enter a valid amount.');answers[key]=value;}
                else if(key==='selectedComparables') {
                    const allowed=new Set((current.propertySnapshot?.comparables || []).map(item=>String(item.pin)));
                    requireCondition(Array.isArray(value) && value.length<=20 && value.every(pin=>typeof pin==='string' && allowed.has(pin)),'Choose comparisons from this property record.');answers[key]=[...new Set(value)];
                } else requireCondition(false,'Unknown questionnaire field.');
            }
            requireCondition(typeof input.step==='string' && /^[a-z_:]{1,80}$/.test(input.step),'Choose a valid questionnaire step.');
            next.questionnaire={answers,step:input.step,updatedAt:now};
            break;
        }
        case 'intake':
            owner(); at('intake', 'preparing');
            requireCondition(input.agency === 'assessor', 'This service supports Cook County Assessor appeals only.');
            requireCondition(input.individualOwner === true, 'This workflow is for property titled in the individual taxpayer’s name. Contact us for other ownership types.');
            requireCondition(input.noExistingAppeal === true, 'Resolve any existing appeal or representation before continuing.');
            requireCondition(Number.isInteger(input.taxYear) && input.taxYear >= 2020 && input.taxYear <= new Date(now).getUTCFullYear() + 1, 'Select a valid assessment tax year.');
            if(current.taxYear) requireCondition(input.taxYear === current.taxYear, 'Start a separate workspace for a different assessment year.');
            requireCondition(['uniformity', 'overvaluation', 'characteristics'].includes(input.reason), 'Select a reason for appeal.');
            if(actor.freePacket || current.service==='assessor_self_service') requireCondition(input.singleFamilyScope===true && input.condo!==true && singleFamilyEligibility(current.propertySnapshot?.details).eligible!==false,'This workflow supports single-family homes with one dwelling unit only.');
            next.intake = { agency: input.agency, taxYear: input.taxYear, ownerName: field(input.ownerName, 'Legal owner name', 200), mailingAddress: field(input.mailingAddress, 'Owner mailing address'), reason: input.reason, explanation: field(input.explanation, 'Explanation', 10000), individualOwner: true, noExistingAppeal: true, confirmedAt: now };
            if(input.singleFamilyScope===true)next.intake.singleFamilyScope=true;
            if (input.requestedMarketValue !== undefined) {
                requireCondition(Number.isFinite(input.requestedMarketValue) && input.requestedMarketValue > 0 && input.requestedMarketValue <= 1e10, 'Enter a valid requested fair market value.');
                requireCondition(input.singleFamilyScope === true && input.condo !== true && singleFamilyEligibility(current.propertySnapshot?.details).eligible!==false, 'This workflow supports single-family homes with one dwelling unit only.');
                next.intake.singleFamilyScope = true;
                requireCondition(typeof input.ownResidence === 'boolean', 'Confirm whether you live at this property.');
                requireCondition(input.recordsConfirmed === true, 'Verify the imported data against your current assessment record.');
                next.intake.requestedMarketValue = input.requestedMarketValue;
                next.intake.pins = field(input.pins, 'All property PINs', 500);
                requireCondition(next.intake.pins.split(/[,;\n]+/).every(pin=>pin.replace(/[-\s]/g,'').match(/^\d{14}$/)), 'Enter each 14-digit PIN, separated by commas.');
                for(const key of ['ownResidence','recentSale','appraisal','condo','damage','affidavit','documentsReviewed','recordsConfirmed']) next.intake[key] = input[key] === true;
                for(const key of ['ownerPhone','mailingCity','mailingState','mailingZip','propertyCity','propertyZip','purchaseDate','sellerName','saleRelationship','attestationFacts']) {
                    if(input[key]!==undefined) {
                        requireCondition(typeof input[key]==='string' && input[key].length <= (key==='attestationFacts'?10000:300), 'Enter valid contact and supporting information.');
                        next.intake[key]=input[key].trim();
                    }
                }
                if(input.purchasePrice!==undefined && input.purchasePrice!=='') {
                    requireCondition(Number.isFinite(Number(input.purchasePrice)) && Number(input.purchasePrice)>0,'Enter a valid purchase price.');
                    next.intake.purchasePrice=Number(input.purchasePrice);
                }
                if(next.intake.purchaseDate)requireCondition(date(next.intake.purchaseDate,'Purchase date')<=today,'Purchase date cannot be in the future.');
                const allowed = new Set((current.propertySnapshot?.comparables || []).map(c=>String(c.pin)));
                requireCondition(Array.isArray(input.selectedComparables) && input.selectedComparables.every(pin=>allowed.has(pin)), 'Select comparisons from this property record.');
                next.intake.selectedComparables = [...new Set(input.selectedComparables)];
            }
            next.status = 'preparing';
            break;
        case 'evidence':
            requireCondition(actor.isOwner || actor.isAdmin, 'Access denied.'); at('intake', 'preparing'); artifact('evidence'); break;
        case 'remove_evidence':
            owner(); at('intake','preparing');
            requireCondition(current.documents.some(d=>d.id===input.documentId && d.kind==='evidence'), 'Evidence not found.');
            next.documents=next.documents.filter(d=>d.id!==input.documentId);
            break;
        case 'packet':
            requireCondition(actor.isOwner || actor.isAdmin, 'Access denied.'); at('preparing'); requireCondition(current.intake, 'Customer intake is required.');
            if(actor.freePacket || current.service==='assessor_self_service') requireCondition(current.intake.singleFamilyScope===true && singleFamilyEligibility(current.propertySnapshot?.details).eligible!==false,'Confirm the single-family home scope before preparing this packet.');
            next.version += 1;
            requireCondition(input.document?.kind === 'packet' && input.document.version === next.version, 'Upload a prepared packet PDF.');
            requireCondition(next.documents.length < 50, 'Document limit reached.');
            next.documents.push(input.document); next.packetId = input.document.id;
            next.status = 'review'; break;
        case 'revise':
            requireCondition(actor.isOwner || actor.isAdmin, 'Access denied.'); at('review', 'approved', 'awaiting_signature', 'signed');
            if (current.envelopeId) requireCondition(input.envelopeVoided === true, 'Void the existing DocuSign envelope before revising.');
            next.status = 'preparing';
            for (const key of ['approval', 'envelopeId', 'signatureReview', 'signedId', 'signedAt', 'certificateId', 'mailingConsent', 'mailing']) delete next[key];
            break;
        case 'approve':
            owner(); at('review'); requireCondition(input.confirmed === true, 'Review the packet and confirm its accuracy.');
            next.approval = { version: current.version, at: now, actor: actor.uid }; next.status = 'approved'; break;
        case 'request_signature':
            admin(); at('approved');
            requireCondition(input.acceptanceChecked === true, 'Confirm that the receiving agency accepts this signature method and any required notarization is arranged.');
            next.envelopeId = field(input.envelopeId, 'DocuSign envelope ID', 200);
            next.signatureReview = field(input.reviewNotes, 'Signature and notarization review notes', 2000);
            next.status = 'awaiting_signature'; break;
        case 'signed_packet':
            admin(); at('awaiting_signature'); next.signedId = artifact('signed_packet'); break;
        case 'certificate':
            admin(); at('awaiting_signature'); next.certificateId = artifact('certificate'); break;
        case 'confirm_signed':
            admin(); at('awaiting_signature');
            requireCondition(current.signedId && current.certificateId && input.completionVerified === true, 'Upload the signed packet and completion certificate, and verify all required signers completed the envelope.');
            next.signedAt = now; next.status = 'signed'; break;
        case 'authorize_mail':
            owner(); at('signed'); requireCondition(input.confirmed === true, 'Review the signed packet and authorize mailing.');
            next.mailingConsent = { version: current.version, at: now, actor: actor.uid }; break;
        case 'mail':
            admin(); at('signed');
            requireCondition(current.mailingConsent?.version === current.version, 'The customer must authorize mailing this signed version.');
            requireCondition(input.rulesChecked === true, 'Verify current filing, signature, copy, representation, and mailing requirements for this agency.');
            const window = actor.freePacket || current.service === 'assessor_self_service' ? requireOpenMailingWindow(current, now) : null;
            next.mailing = { recipient: field(input.recipient, 'Agency and full mailing address', 1500), carrier: field(input.carrier, 'Carrier', 100), tracking: field(input.tracking, 'Tracking number', 200), mailedOn: date(input.mailedOn, 'Mailing date'), filingDeadline: window?.closesOn || date(input.filingDeadline, 'Verified filing deadline'), notes: field(input.reviewNotes, 'Filing and mailing rule review', 2000), proofId: artifact('mailing_proof') };
            if (window) {
                requireCondition(next.mailing.mailedOn >= window.opensOn, 'Mailing date is before the township appeal window opens.');
                next.mailing.calendar = window;
            }
            requireCondition(next.mailing.mailedOn <= today, 'Record mailing only after dispatch.');
            requireCondition(next.mailing.mailedOn <= next.mailing.filingDeadline, 'Mailing date is after the recorded filing deadline.');
            next.status = 'mailed'; break;
        case 'delivered':
            admin(); at('mailed');
            next.delivery = { deliveredOn: date(input.deliveredOn, 'Delivery date'), proofId: artifact('delivery_proof') };
            requireCondition(next.delivery.deliveredOn <= today, 'Delivery date cannot be in the future.');
            requireCondition(next.delivery.deliveredOn >= current.mailing.mailedOn, 'Delivery cannot precede mailing.');
            next.status = 'delivered'; break;
        case 'filed':
            admin(); at('mailed', 'delivered');
            next.filing = { docket: field(input.docket, 'County docket or confirmation number', 200), confirmedOn: date(input.confirmedOn, 'County confirmation date'), receiptId: artifact('filing_receipt') };
            requireCondition(next.filing.confirmedOn <= today, 'Confirmation date cannot be in the future.');
            next.status = 'filed'; break;
        default: throw Object.assign(new Error('Unknown packet action.'), { status: 400 });
    }
    return next;
}
