import { requirements, preparationProblems, evidenceCategories, OFFICIAL_FORM } from './packet-requirements.js';
import { authFetch, onAuthUserChanged } from './auth-client.js?v=20261103-packet-access';

const labels = { intake: 'Your information', preparing: 'Preparing packet', review: 'Review packet', approved: 'Download or choose fulfillment', awaiting_signature: 'Awaiting signatures', signed: 'Signed', mailed: 'Mailed', delivered: 'Delivered by carrier', filed: 'County filing confirmed' };
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const message = (text, error = false) => { const el = document.getElementById('packet-message'); el.textContent = text; el.dataset.error = error; };
const input = (name, label, type = 'text', value = '', extra = '') => `<label>${label}<input name="${name}" type="${type}" value="${escape(value)}" required ${extra}></label>`;
const check = (name, label) => `<label><input type="checkbox" name="${name}" required>${label}</label>`;
const notes = (name, label, value = '') => `<label>${label}<textarea name="${name}" required maxlength="10000">${escape(value)}</textarea></label>`;
const file = (label = 'PDF document', evidence = false) => `<label>${label}<input name="file" type="file" accept="${evidence ? '.pdf,.jpg,.jpeg,.png' : '.pdf'}" required></label><p class="packet-muted">Maximum 15 MB. Remove Social Security and financial account numbers before uploading.</p>`;
const form = (action, title, fields, button) => `<form class="packet-card" data-action="${action}"><h2>${title}</h2>${fields}<button class="btn btn-primary" type="submit">${button}</button></form>`;
let selectedId = new URLSearchParams(location.search).get('id');
let current;
let sessionRevision = 0;
document.getElementById('packet-year').value=new Date().getFullYear();
const propertyQuery=new URLSearchParams(location.search).get('property');
const money=value=>value==null?'Not available':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const toggle=(name,label,value=false)=>`<label><input type="checkbox" name="${name}" ${value?'checked':''}>${label}</label>`;
const signInLink = document.getElementById('packet-sign-in');
signInLink.href = `login.html?next=${encodeURIComponent(location.pathname + location.search)}`;

const propertySelect = document.getElementById('packet-property');
const startButton = document.getElementById('packet-start');
const retryButton = document.getElementById('packet-retry');
let currentSessionUser = null;
let pendingPropertyId = propertyQuery ? Number(propertyQuery) : null;
let openingRevision = null;
let pickerAccess = null;

async function requestJSON(url, options = {}, failure = 'Could not load your appeal.') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await authFetch(url, {...options, signal:controller.signal});
        const result = await response.json().catch(() => null);
        if (!response.ok) throw Object.assign(new Error(`${failure} ${result?.error || 'Please try again.'}`), {status:response.status});
        if (result === null) throw new Error(`${failure} Please try again.`);
        return result;
    } catch (error) {
        if (error.name === 'AbortError') throw new Error('The request took too long. Try again to continue with the same property.');
        throw error;
    } finally { clearTimeout(timeout); }
}

function showLoadError(error, revision) {
    if (revision !== sessionRevision) return;
    message(error.message, true);
    retryButton.hidden = [400,403,404].includes(error.status);
    if (error.status === 403) {
        document.getElementById('packet-waitlist').hidden = false;
        document.getElementById('packet-orders').hidden = true;
    }
}

async function startOrResume(propertyId, revision) {
    if (openingRevision === revision) return;
    const taxYear = Number(document.getElementById('packet-year').value);
    if (!Number.isInteger(propertyId) || propertyId < 1) throw Object.assign(new Error('Choose a saved property first.'), {status:400});
    if (!Number.isInteger(taxYear) || taxYear < 2020 || taxYear > 2100) throw Object.assign(new Error('Choose a valid assessment year.'), {status:400});
    openingRevision = revision;
    startButton.disabled = true;
    propertySelect.disabled = true;
    startButton.textContent = 'Opening appeal…';
    message('Opening your appeal…');
    try {
        const result = await requestJSON('/api/packet-start', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({propertyId,taxYear})}, 'Could not open your appeal.');
        if (revision !== sessionRevision) return;
        if (!result.id) throw new Error('Your workspace response was incomplete. Try again to resume it.');
        selectedId = result.id;
        window.history.replaceState({}, '', `appeal-packet.html?id=${encodeURIComponent(selectedId)}`);
        signInLink.href = `login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
        await load();
    } finally {
        if (openingRevision === revision) openingRevision = null;
        if (revision === sessionRevision) {
            startButton.textContent = 'Start or resume appeal';
            startButton.disabled = Boolean(selectedId) || !propertySelect.value;
            propertySelect.disabled = Boolean(selectedId) || propertySelect.options.length < 2;
        }
    }
}

async function loadOrderList(revision) {
    try {
        const orders = await requestJSON('/api/history', {}, 'Could not load previous appeals.');
        if (revision !== sessionRevision || selectedId) return;
        const packets = orders.filter(order => order.id.startsWith('free_'));
        document.getElementById('order-list').innerHTML = packets.map(order => `<p><a href="appeal-packet.html?id=${encodeURIComponent(order.id)}">${escape(order.propertyAddress)} — open packet</a></p>`).join('');
        document.getElementById('packet-existing').hidden = packets.length === 0;
    } catch {
        if (revision === sessionRevision && !selectedId) {
            document.getElementById('order-list').textContent = 'Previous appeals could not be listed. You can still start or resume using your saved property above.';
            document.getElementById('packet-existing').hidden = false;
        }
    }
}

async function checkPickerAccess(revision) {
    try {
        const access = await requestJSON('/api/appeal-access');
        if (revision !== sessionRevision || selectedId || pendingPropertyId !== null) return;
        pickerAccess = access.allowed === true;
        if (!pickerAccess) {
            document.getElementById('packet-orders').hidden = true;
            document.getElementById('packet-waitlist').hidden = false;
            message('Free appeal testing is currently by invitation.');
        }
    } catch {
        // This is an advisory UI check. packet-start and packet always enforce
        // access on the server, including when this separate service fails.
    }
}

async function loadPropertyPicker(revision) {
    void checkPickerAccess(revision);
    void loadOrderList(revision);
    const properties = await requestJSON('/api/addresses?summary=1', {}, 'Could not load saved properties.');
    if (revision !== sessionRevision) return;
    if (!Array.isArray(properties)) throw new Error('Your saved properties could not be read. Please try again.');
    propertySelect.innerHTML = '<option value="">Choose a saved property</option>' + properties.map(p => `<option value="${Number(p.id)}">${escape(p.address)}</option>`).join('');
    propertySelect.disabled = properties.length === 0;
    if (pickerAccess === false) return;
    document.getElementById('packet-orders').hidden = false;
    message(properties.length ? 'Choose a saved property and assessment year to start or resume.' : 'Add a property in My account, then return here to prepare your appeal.');
}

async function initializeWorkspace(user) {
    const revision = ++sessionRevision;
    pickerAccess = null;
    retryButton.hidden = true;
    startButton.disabled = true;
    propertySelect.disabled = true;
    document.getElementById('packet-orders').hidden = true;
    document.getElementById('packet-existing').hidden = true;
    document.getElementById('packet-workspace').hidden = true;
    document.getElementById('packet-waitlist').hidden = true;
    signInLink.hidden = Boolean(user?.emailVerified);
    signInLink.textContent = user ? 'Verify email' : 'Sign in';
    document.getElementById('packet-session').textContent = user ? `Signed in as ${user.email}` : 'You are signed out';
    if (!user || !user.emailVerified) {
        current = null;
        document.getElementById('order-list').replaceChildren();
        propertySelect.innerHTML = '<option value="">Sign in with a verified email to choose a property</option>';
        document.getElementById('packet-waitlist').hidden = false;
        document.getElementById('packet-workspace').replaceChildren();
        message(user ? 'Verify your email to prepare your appeal. Your account is still signed in.' : 'Sign in to prepare your appeal. We will return you to this property.');
        return;
    }
    try {
        if (selectedId) {
            message('Loading your appeal…');
            await load();
        } else if (pendingPropertyId !== null) {
            // This property was already selected in My Account. The API checks
            // ownership and access; another property-list request is unnecessary.
            await startOrResume(pendingPropertyId, revision);
        } else {
            message('Loading your saved properties…');
            await loadPropertyPicker(revision);
        }
    } catch (error) { showLoadError(error, revision); }
}

propertySelect.addEventListener('change', () => { startButton.disabled = !propertySelect.value; });
startButton.addEventListener('click', async () => {
    if (startButton.disabled) return;
    pendingPropertyId = Number(propertySelect.value);
    retryButton.hidden = true;
    const revision = sessionRevision;
    try { await startOrResume(pendingPropertyId, revision); }
    catch (error) { showLoadError(error, revision); }
});
retryButton.addEventListener('click', () => { void initializeWorkspace(currentSessionUser); });
onAuthUserChanged(user => {
    currentSessionUser = user;
    return initializeWorkspace(user);
}, error => {
    document.getElementById('packet-session').textContent = 'Session could not be restored';
    message(error.message || 'Could not restore your session. Please reload and try again.', true);
});

async function load() {
    const revision = sessionRevision;
    const data = await requestJSON(`/api/packet?id=${encodeURIComponent(selectedId)}`, {}, 'Could not load your appeal.');
    if (revision !== sessionRevision) return;
    current = data;
    if(data.packetId)selectedId=data.packetId;
    render();
    document.getElementById('packet-orders').hidden = true;
    document.getElementById('packet-existing').hidden = true;
    retryButton.hidden = true;
    message('Packet loaded.');
}

function render() {
    const { appeal, state: s, isAdmin, isOwner, storageReady, events, fulfillmentPaid, signature } = current;
    const free=selectedId.startsWith('free_');
    const editable = free || appeal.payment_status === 'paid';
    const intake = s.intake || {};
    const snapshot=s.propertySnapshot || {}, details=snapshot.details || {};
    const preparing=['intake','preparing'].includes(s.status);
    let html = `<section class="packet-card"><h2>${escape(appeal.property_address)}</h2><p>PIN: ${escape(intake.pins || snapshot.pin || appeal.property_pin || 'Confirm all PINs during preparation')} · Payment: ${free ? (fulfillmentPaid ? 'Fulfillment paid · preparation free' : 'Free preparation') : escape(appeal.payment_status)}</p><ol class="packet-steps">${Object.entries(labels).map(([key, label]) => `<li ${key === s.status ? 'aria-current="step"' : ''}>${label}</li>`).join('')}</ol><p><strong>${labels[s.status]}</strong> · Packet version ${s.version}</p><p class="packet-muted">A signed packet or postal tracking number is not confirmation that the county has filed your appeal.</p></section>`;
    if(snapshot.address) html += propertySummary(snapshot);
    if (!storageReady) html += '<p>Document uploads are not available yet. Please contact us before sending sensitive documents.</p>';
    if (intake.ownerName) html += `<section class="packet-card"><h2>Owner instructions</h2><dl><dt>Owner</dt><dd>${escape(intake.ownerName)}</dd><dt>Agency / tax year</dt><dd>${escape(intake.agency.replaceAll('_', ' '))} / ${intake.taxYear}</dd><dt>Mailing address</dt><dd>${escape(intake.mailingAddress)}</dd><dt>Reason</dt><dd>${escape(intake.reason)}</dd></dl><pre>${escape(intake.explanation)}</pre></section>`;
    if (isOwner && editable && ['intake', 'preparing'].includes(s.status)) {
        html += form('intake', 'Tell us about your appeal', `${input('ownerName', 'Legal owner name', 'text', intake.ownerName || details.mailingName || appeal.customer_name)}${input('mailingAddress', 'Your complete mailing address', 'text', intake.mailingAddress || details.mailingAddress)}<div class="packet-grid"><label>Appeal agency<select name="agency"><option value="assessor" ${intake.agency === 'assessor' ? 'selected' : ''}>Cook County Assessor</option></select></label>${input('taxYear', 'Assessment tax year', 'number', intake.taxYear || s.taxYear || new Date().getFullYear(), `min="2020" max="2100" ${s.taxYear?'readonly':''}`)}</div><label>Reason<select name="reason">${[['uniformity','Similar properties assessed lower'],['overvaluation','Market value is too high'],['characteristics','Property description is incorrect']].map(([value,label]) => `<option value="${value}" ${intake.reason === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>${input('pins','All PINs included in this appeal (comma separated)','text',intake.pins || snapshot.pin || appeal.property_pin)}${input('requestedMarketValue','Your requested fair market value ($), not assessed value','number',intake.requestedMarketValue || '', 'min="1" step="0.01"')}${input('filingDeadline','Verified township appeal deadline','date',intake.filingDeadline)}<p><a href="https://www.cookcountyassessoril.gov/assessment-calendar-and-deadlines" target="_blank" rel="noopener">Check the official filing calendar</a>. Preparing a packet does not file an appeal or extend the deadline.</p>${notes('explanation', 'Your explanation and why your evidence supports the requested value', intake.explanation)}<fieldset><legend>Which documents apply?</legend>${toggle('ownResidence','I live at this property as my own residence (leave unchecked for a rental).',intake.ownResidence)}${toggle('recentSale','There was a sale within two years before the assessment lien date, or I am relying on a sale.',intake.recentSale)}${toggle('appraisal','An existing appraisal / valuation report falls within the required disclosure period.',intake.appraisal)}${toggle('condo','This is an individual condo / townhome unit.',intake.condo)}${toggle('damage','My argument relies on damage, condition or vacancy.',intake.damage)}${toggle('affidavit','My facts or forms require an affidavit, attestation or notarization.',intake.affidavit)}</fieldset>${comparisonChoices(snapshot,intake)}${check('recordsConfirmed','I verified the assessment year, ownership, all PINs and current values against the county record. Imported data may be from an earlier year.')}${toggle('documentsReviewed','I reviewed the applicable official forms, required attachments, photo dates, signatures and any notarization requirements.',intake.documentsReviewed)}${check('residentialScope','This is residential property with no more than six dwelling units, not commercial or mixed-use property.')}${check('individualOwner', 'The property is titled in my individual name. I will review and sign my own appeal.')}${check('noExistingAppeal', 'I have checked for existing appeals and representation; there is no conflicting filing or engagement.')}`, 'Save information');
    }
    if(intake.ownerName) html += checklistCard(s);
    html += `<section class="packet-card"><h2>Your documents and downloads</h2>${s.documents.map(doc => `<div class="packet-document"><span>${escape(doc.name)}<br><small>${escape(evidenceCategories[doc.category] || doc.kind.replaceAll('_',' '))} · version ${doc.version}</small></span><button type="button" class="btn btn-secondary" data-document="${doc.id}">Download</button>${isOwner && preparing && doc.kind==='evidence'?`<button type="button" class="btn btn-secondary" data-remove="${doc.id}">Remove</button>`:''}</div>`).join('') || '<p>No documents uploaded yet.</p>'}</section>`;
    if (editable && storageReady && ['intake','preparing'].includes(s.status)) html += form('evidence', 'Add supporting evidence', `<label>Document type<select name="category">${Object.entries(evidenceCategories).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><label>Photo date (required for subject photo)<input type="date" name="photoDate"></label>${file('PDF, JPG or PNG',true)}<p>Upload complete, legible documents. Uploaded files are included in the combined PDF; remove outdated files before building.</p>`, 'Upload evidence');
    if (isOwner && editable && s.status === 'review') html += form('approve', 'Review your prepared packet', `<p>Download the current packet above and check every field and supporting document. Contact us for corrections before approving.</p>${check('confirmed','I reviewed this packet version and confirm that its information is accurate. I selected my appeal grounds and requested value. This approval is not my appeal signature.')}`, 'Confirm reviewed packet');
    if (s.status === 'awaiting_signature') html += '<section class="packet-card"><h2>Sign your documents</h2><p>Use the invitation sent directly by DocuSign. After all required signers complete it, we will verify and upload the signed packet and completion certificate.</p></section>';
    if (isOwner && editable && s.status === 'signed' && !s.mailingConsent) html += form('authorize_mail', 'Authorize mailing', `<p>Download and review the signed packet above. We will check the agency’s filing requirements before dispatch. The $49 fulfillment price includes DocuSign signing, printing, assembly, postage and tracking.</p>${check('confirmed','I authorize Cook County Tax Compare to mail this signed packet version as instructed. I understand that mailing does not guarantee timely county filing or a reduced assessment.')}`, 'Authorize mailing this packet');
    if (s.delivery) html += `<section class="packet-card"><h2>Postal delivery</h2><p>Carrier delivery recorded ${escape(s.delivery.deliveredOn)}. This is not county filing confirmation.</p></section>`;
    if (s.mailingConsent) html += '<section class="packet-card"><p>You authorized mailing this signed packet. Awaiting dispatch or delivery confirmation.</p></section>';
    if (s.mailing) html += `<section class="packet-card"><h2>Mailing record</h2><p>${escape(s.mailing.carrier)} · ${escape(s.mailing.tracking)} · Mailed ${escape(s.mailing.mailedOn)}</p><pre>${escape(s.mailing.recipient)}</pre><p>Recorded filing deadline: ${escape(s.mailing.filingDeadline)}</p></section>`;
    if (s.filing) html += `<section class="packet-card"><h2>County confirmation</h2><p>Docket: ${escape(s.filing.docket)} · Confirmed ${escape(s.filing.confirmedOn)}</p></section>`;
    if (isOwner && free && s.status==='preparing' && storageReady) {
        const missing=preparationProblems(s);
        html += form('generate','Build your appeal packet',`<p>Combine your completed official application, statement, selected property comparisons and uploaded evidence into one downloadable PDF.</p>${missing.length?`<p>Still needed: ${missing.map(escape).join('; ')}</p>`:'<p>Your checklist is complete. Build the packet, then review every page.</p>'}`,'Build PDF for review');
    }
    if (isOwner && ['review','approved'].includes(s.status)) html += `<section class="packet-card"><h2>Submit it yourself · Free</h2><p>Download your packet, complete every required signature and any notarization, and submit through the Assessor’s accepted filing channel before your township deadline. If filing online, enter your application in SmartFile and upload the appropriate evidence.</p><a class="btn btn-secondary" href="https://www.cookcountyassessoril.gov/online-appeals" target="_blank" rel="noopener">Open Assessor online appeals</a><p>Keep the county’s confirmation number and submitted copy. A download or mailing receipt does not confirm county filing.</p></section>`;
    if (isOwner && free && ['review','approved'].includes(s.status) && !signature) html += form('revise','Make corrections','<p>Return to preparation; approval resets.</p>','Edit my packet');
    if (isOwner && free && s.status==='approved' && !fulfillmentPaid) html += form('purchase','Optional DocuSign + print and mail · $49',`<p>You can download your packet above and submit it yourself for free. Fulfillment includes DocuSign signing, printing, assembly, postage and tracking for this version. It does not guarantee county acceptance or a reduction.</p><p>Demo pilot: signature acceptance is assumed for testing and has not been confirmed by the Assessor. Demo signing cannot be dispatched as a real appeal.</p>${check('fulfillmentAccepted','I choose the optional $49 fulfillment service for this approved packet version.')}`,'Continue to fulfillment checkout');
    if (free && fulfillmentPaid) html += `<section class="packet-card"><h2>DocuSign signing included</h2><p>${signature ? `Envelope status: ${escape(signature.status)} · ${escape(signature.environment)}` : 'The fulfillment desk will check signature placement and send your invitation.'}</p><p>Use the signing link delivered by DocuSign to your verified account email. Signed files and the completion certificate will appear here after synchronization.</p></section>`;
    if (free && signature?.envelope_id && ['approved','awaiting_signature','signed'].includes(s.status)) html += form('ds_sync','Check signing status','<p>Checks are limited to once every 15 minutes. Completed documents are retrieved directly from DocuSign.</p>','Check DocuSign');
    if (isAdmin && editable) html += adminForms(s, storageReady, free, fulfillmentPaid, signature);
    html += `<section class="packet-card"><h2>Activity</h2><ul>${events.map(event => `<li>${escape(event.created_at)} UTC — ${escape(event.action.replaceAll('_',' '))}: ${escape(labels[event.status])}</li>`).join('') || '<li>Workspace created. Intake has not been submitted.</li>'}</ul></section>`;
    const workspace = document.getElementById('packet-workspace');
    workspace.innerHTML = html; workspace.hidden = false;
    workspace.querySelectorAll('form').forEach(el => el.addEventListener('submit', submit));
    workspace.querySelectorAll('[data-remove]').forEach(el=>el.addEventListener('click',async()=>{el.disabled=true;try{const r=await authFetch(`/api/packet?id=${encodeURIComponent(selectedId)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'remove_evidence',documentId:el.dataset.remove,revision:current.revision})});const d=await r.json();if(!r.ok)throw new Error(d.error);await load();}catch(e){message(e.message,true);el.disabled=false;}}));
    workspace.querySelectorAll('[data-document]').forEach(el => el.addEventListener('click', () => download(el.dataset.document)));
}

function adminForms(s, storageReady, free, paid, signature) {
    let html = '<section class="packet-card"><h2>Preparation desk</h2><p>Prepare the packet using current official forms and the customer’s evidence. For paid fulfillment, create a DocuSign draft, preview signature positions in your DocuSign account, then send through this service. Standard signing does not notarize documents.</p></section>';
    if (s.status === 'preparing' && storageReady) html += form('packet', 'Upload packet for owner review', file('Complete prepared packet PDF'), 'Publish packet for review');
    if (['review','approved','awaiting_signature','signed'].includes(s.status) && (!free || !signature || signature.status==='voided')) html += form('revise','Return packet for corrections', `${s.envelopeId ? check('envelopeVoided','I voided the previous DocuSign envelope so it cannot be used for the revised packet.') : ''}<p>Previous approval and mailing authorization will be cleared. The customer must review the new version.</p>`, 'Return to preparation');
    if (!free && s.status === 'approved') html += form('request_signature','Record DocuSign invitation', `${input('envelopeId','Envelope ID from DocuSign')}${notes('reviewNotes','Agency acceptance and notarization review')}${check('acceptanceChecked','I checked acceptance of the signature method and any notarization requirement, and sent the approved packet to the correct owner in DocuSign.')}`, 'Record signature request');
    if (!free && s.status === 'awaiting_signature') {
        html += `<section class="packet-card"><p>DocuSign envelope: ${escape(s.envelopeId)}</p></section>`;
        if (storageReady) html += form('signed_packet','Upload completed signed packet',file(),'Upload signed packet') + form('certificate','Upload DocuSign completion certificate',file(),'Upload certificate');
        html += form('confirm_signed','Verify completed signatures',check('completionVerified','I verified the completed envelope, signer identities, correct packet version, and any required notarization against the uploaded documents.'),'Mark signatures verified');
    }
    if (s.status === 'signed' && s.mailingConsent && storageReady && (!free || (paid && signature?.environment==='production'))) html += form('mail','Record dispatched mailing', `${input('recipient','Receiving agency and full mailing address')}${input('carrier','Carrier / service', 'text', 'USPS Certified Mail')}${input('tracking','Tracking number')}<div class="packet-grid">${input('mailedOn','Actual mailing date','date')}${input('filingDeadline','Verified filing deadline','date')}</div>${notes('reviewNotes','Source and review of current mailing, timeliness, copies, signature, and representation requirements')}${file('Postal acceptance / mailing proof PDF')}${check('rulesChecked','I verified the current requirements and mailed the authorized, signed packet with all required copies. I checked whether receipt or postmark controls timeliness.')}`, 'Record mailing');
    if (s.status === 'mailed' && storageReady) html += form('delivered','Record carrier delivery',`${input('deliveredOn','Actual delivery date','date')}${file('Carrier delivery proof PDF')}`,'Record delivery');
    if (['mailed','delivered'].includes(s.status) && storageReady) html += form('filed','Record official county filing confirmation', `${input('docket','County docket or filing confirmation number')}${input('confirmedOn','County confirmation date','date')}${file('Official county confirmation PDF (not postal delivery tracking)')}`, 'Confirm county filing');
    if (free && paid && s.status==='approved' && !signature) html += form('ds_create','Create DocuSign demo draft',`${notes('positions','Signature positions as JSON: [{"page":1,"x":100,"y":500}]','[{"page":1,"x":100,"y":500}]')}${check('placementReviewed','I checked every signature field on the approved PDF; the coordinates above match its pages.')}${check('noNotaryRequired','This packet requires no notarization and only the account owner must sign. Other packets are outside this integrated signing flow.')}`,'Create signing draft');
    if (free && signature?.status==='creating') html += form('ds_recover','Recover uncertain draft creation','<p>Find the original envelope by its stored transaction ID; do not create a duplicate.</p>','Recover envelope');
    if (free && paid && ['created','send_uncertain'].includes(signature?.status)) html += form('ds_send','Send DocuSign invitation',`<p>Envelope: ${escape(signature.envelope_id)}. Preview the draft in your DocuSign account before sending.</p>${check('previewConfirmed','I previewed the exact envelope and verified every signature position and the owner recipient.')}`,'Send signing invitation');
    if (free && signature?.envelope_id && !['completed','voided'].includes(signature.status)) html += form('ds_void','Void envelope before corrections','<p>This cancels the existing signing request in DocuSign.</p>','Void envelope');
    return html;
}

async function submit(event) {
    event.preventDefault();
    const el = event.currentTarget, button = el.querySelector('button[type=submit]');
    button.disabled = true;
    try {
        const values = new FormData(el), data = { action: el.dataset.action, revision: current.revision };
        for (const [key,value] of values) if (key !== 'file') data[key] = value;
        el.querySelectorAll('[type=checkbox]').forEach(box => {if(box.name!=='selectedComparables')data[box.name] = box.checked;});
        if (data.taxYear) data.taxYear = Number(data.taxYear);
        if(data.action==='intake'){data.requestedMarketValue=Number(data.requestedMarketValue);data.selectedComparables=values.getAll('selectedComparables');}
        if(data.action==='purchase' || data.action.startsWith('ds_')) {
            const signing=data.action.startsWith('ds_');
            if(signing){data.action=data.action.slice(3);if(data.positions)data.positions=JSON.parse(data.positions);}
            const response=await authFetch(signing?'/api/packet-signature':'/api/create-checkout-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,packetId:selectedId})});
            const result=await response.json();if(!response.ok)throw new Error(result.error);
            if(result.url){location.href=result.url;return;}await load();message(result.message||'Saved.');return;
        }
        let body, headers;
        if (values.get('file')) {
            const upload = values.get('file');
            if (upload.size > 15 * 1024 * 1024) throw new Error('Please choose a file under 15 MB.');
            body = new FormData(); body.set('data',JSON.stringify(data)); body.set('file',upload);
        } else { body = JSON.stringify(data); headers = { 'Content-Type':'application/json' }; }
        const response = await authFetch(`/api/packet?id=${encodeURIComponent(selectedId)}`, { method:'POST',headers,body });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not save.');
        await load(); message('Saved.');
    } catch (error) { message(error.message,true); }
    finally { button.disabled = false; }
}

async function download(id) {
    try {
        const response = await authFetch(`/api/packet?id=${encodeURIComponent(selectedId)}&document=${encodeURIComponent(id)}`);
        if (!response.ok) throw new Error('Could not download the document.');
        const url = URL.createObjectURL(await response.blob()), link = document.createElement('a');
        link.href = url; link.download = current.state.documents.find(doc => doc.id === id)?.name || 'document.pdf'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { message(error.message, true); }
}

function propertySummary(snapshot) {
    const d=snapshot.details || {};
    return `<section class="packet-card"><h2>1. Review your saved property</h2><p>${escape(snapshot.source)}</p><dl>${[['PINs',snapshot.pin],['Township',d.townshipName],['Class',d.classCode],['Building area',d.homeSize ? `${d.homeSize} sq ft`:null],['Year built',d.yearBuilt],['Imported value',money(d.taxableValue)],['Last appeal',d.lastAppealYear]].map(([label,value])=>`<dt>${label}</dt><dd>${escape(value??'Not available')}</dd>`).join('')}</dl>${snapshot.warning?`<p>${escape(snapshot.warning)}</p>`:''}</section>`;
}
function comparisonChoices(snapshot,intake) {
    return `<fieldset><legend>Your assessment comparisons</legend><p>Choose the properties that support your argument after reviewing their similarities and current county records. Uniformity claims need at least three comparisons; five are recommended. You may upload your own comparison exhibit instead.</p>${(snapshot.comparables||[]).map(c=>`<label class="packet-comparison"><input type="checkbox" name="selectedComparables" value="${escape(c.pin)}" ${intake.selectedComparables?.includes(String(c.pin))?'checked':''}><strong>${escape(c.address)}</strong><br>PIN ${escape(c.pin)} · Class ${escape(c.classCode)} · ${escape(c.homeSize??'?')} sq ft · Built ${escape(c.yearBuilt??'?')} · Imported value ${escape(money(c.taxableValue))}</label>`).join('')||'<p>No imported comparisons available. Upload your comparison exhibit with PINs and supporting records.</p>'}</fieldset>`;
}
function checklistCard(state) {
    return `<section class="packet-card"><h2>2. Gather the required documents</h2><p><a href="${OFFICIAL_FORM}" target="_blank" rel="noopener">Get the current official Assessor application</a>. Transfer your reviewed property and owner information to the official form, then upload the completed PDF. For $49 fulfillment, leave its signature blocks unsigned for DocuSign.</p><ol class="packet-checklist">${requirements(state).map(r=>`<li><strong>${r.done?'Added':'Needed'}: ${escape(r.title)}</strong><p>${escape(r.detail)}</p><small>${escape(r.signature)}</small></li>`).join('')}</ol><p>“Added” means the document is present, not that its contents have been accepted by the county. This workflow covers individually owned residential property with up to six units. Commercial, larger rental buildings and entity-owned properties need a separate document review.</p></section>`;
}
