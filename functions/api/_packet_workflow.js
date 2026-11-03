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
        case 'intake':
            owner(); at('intake', 'preparing');
            requireCondition(input.agency === 'assessor', 'This service supports Cook County Assessor appeals only.');
            requireCondition(input.individualOwner === true, 'This workflow is for property titled in the individual taxpayer’s name. Contact us for other ownership types.');
            requireCondition(input.noExistingAppeal === true, 'Resolve any existing appeal or representation before continuing.');
            requireCondition(Number.isInteger(input.taxYear) && input.taxYear >= 2020 && input.taxYear <= new Date(now).getUTCFullYear() + 1, 'Select a valid assessment tax year.');
            requireCondition(['uniformity', 'overvaluation', 'characteristics'].includes(input.reason), 'Select a reason for appeal.');
            next.intake = { agency: input.agency, taxYear: input.taxYear, ownerName: field(input.ownerName, 'Legal owner name', 200), mailingAddress: field(input.mailingAddress, 'Owner mailing address'), reason: input.reason, explanation: field(input.explanation, 'Explanation', 10000), individualOwner: true, noExistingAppeal: true, confirmedAt: now };
            next.status = 'preparing';
            break;
        case 'evidence':
            requireCondition(actor.isOwner || actor.isAdmin, 'Access denied.'); at('intake', 'preparing'); artifact('evidence'); break;
        case 'packet':
            requireCondition(actor.isOwner || actor.isAdmin, 'Access denied.'); at('preparing'); requireCondition(current.intake, 'Customer intake is required.');
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
            next.mailing = { recipient: field(input.recipient, 'Agency and full mailing address', 1500), carrier: field(input.carrier, 'Carrier', 100), tracking: field(input.tracking, 'Tracking number', 200), mailedOn: date(input.mailedOn, 'Mailing date'), filingDeadline: date(input.filingDeadline, 'Verified filing deadline'), notes: field(input.reviewNotes, 'Filing and mailing rule review', 2000), proofId: artifact('mailing_proof') };
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
