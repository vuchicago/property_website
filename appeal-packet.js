import { requirements, preparationProblems, evidenceCategories, OFFICIAL_FORM } from './packet-requirements.js?v=20261103-market-report';
import { authFetch, onAuthUserChanged } from './auth-client.js?v=20261103-checkout-download';
import { singleFamilyEligibility } from './packet-scope.js?v=20261103-checkout-download';
import { mountAppealQuestions } from './appeal-questions.js?v=20261103-early-photo';
import { lowerValuationComparables, impliedMarketValue, MAX_APPEAL_COMPARISONS } from './packet-comparisons.js?v=20261103-market-report';

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
let questionController=null;
let openQuestionsOnLoad=propertyQuery!==null;

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
    questionController?.destroy();questionController=null;
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
    openQuestionsOnLoad=true;
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
    questionController?.destroy();questionController=null;
    const { appeal, state: s, isAdmin, isOwner, storageReady, events, fulfillmentPaid, signature } = current;
    const free=selectedId.startsWith('free_');
    const eligibility=singleFamilyEligibility(s.propertySnapshot?.details);
    const editable = (free || appeal.payment_status === 'paid') && (!free || eligibility.eligible!==false);
    const intake = s.intake || {};
    const snapshot=s.propertySnapshot || {}, details=snapshot.details || {};
    const preparing=['intake','preparing'].includes(s.status);
    const guided=isOwner && free && editable && preparing;
    let html = `<section class="packet-card"><h2>${escape(appeal.property_address)}</h2><p>PIN: ${escape(intake.pins || snapshot.pin || appeal.property_pin || 'Confirm all PINs during preparation')} · Payment: ${free ? (fulfillmentPaid ? 'Fulfillment paid · preparation free' : 'Free preparation') : escape(appeal.payment_status)}</p><ol class="packet-steps">${Object.entries(labels).map(([key, label]) => `<li ${key === s.status ? 'aria-current="step"' : ''}>${label}</li>`).join('')}</ol><p><strong>${labels[s.status]}</strong> · Packet version ${s.version}</p><p class="packet-muted">A signed packet or postal tracking number is not confirmation that the county has filed your appeal.</p></section>`;
    if(guided)html=`<section class="packet-flow-header"><span class="packet-flow-status">${s.intake?.ownerName?'Draft saved':'Let’s get started'}</span><h2>${escape(appeal.property_address)}</h2><p>Assessment year ${s.taxYear || intake.taxYear} · Single-family Assessor appeal</p></section>`;
    if(snapshot.address && !guided) html += propertySummary(snapshot);
    if(free && eligibility.eligible===false) html += `<section class="packet-card"><h2>Single-family homes only</h2><p>${escape(eligibility.message)} Existing documents remain available below.</p></section>`;
    if (!storageReady) html += '<p>Document uploads are not available yet. Please contact us before sending sensitive documents.</p>';
    if (intake.ownerName && !guided) html += `<section class="packet-card"><h2>Owner instructions</h2><dl><dt>Owner</dt><dd>${escape(intake.ownerName)}</dd><dt>Agency / tax year</dt><dd>${escape(intake.agency.replaceAll('_', ' '))} / ${intake.taxYear}</dd><dt>Mailing address</dt><dd>${escape(intake.mailingAddress)}</dd><dt>Reason</dt><dd>${escape(intake.reason)}</dd></dl><pre>${escape(intake.explanation || (intake.reason && intake.reason !== 'uniformity' ? '' : 'I request review of my property assessment for uniformity. My selected comparable properties and supporting records are included for consideration.'))}</pre></section>`;
    if (isOwner && editable && !guided && ['intake', 'preparing'].includes(s.status)) {
        html += form('intake', 'Tell us about your appeal', `${input('ownerName', 'Legal owner name', 'text', intake.ownerName || details.mailingName || appeal.customer_name)}${input('mailingAddress', 'Your complete mailing address', 'text', intake.mailingAddress || details.mailingAddress)}${input('ownerPhone','Phone number for the official application','tel',intake.ownerPhone || '')}${additionalOwnerFields(current.officialForms,intake)}<p>We use your verified account email for the application. We prefill the official forms; you review and sign the completed packet.</p><div class="packet-grid"><label>Appeal agency<select name="agency"><option value="assessor" ${intake.agency === 'assessor' ? 'selected' : ''}>Cook County Assessor</option></select></label>${input('taxYear', 'Assessment tax year', 'number', intake.taxYear || s.taxYear || new Date().getFullYear(), `min="2020" max="2100" ${s.taxYear?'readonly':''}`)}</div><label>Reason<select name="reason">${[['uniformity','Similar properties assessed lower'],['overvaluation','Market value is too high'],['characteristics','Property description is incorrect']].map(([value,label]) => `<option value="${value}" ${intake.reason === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>${input('pins','All PINs included in this appeal (comma separated)','text',intake.pins || snapshot.pin || appeal.property_pin)}${input('requestedMarketValue','Your requested fair market value ($), not assessed value','number',intake.requestedMarketValue || '', 'min="1" step="0.01"')}<p>If you choose $49 DocuSign, print and mail fulfillment, we manage the township appeal calendar. We hold your signed, authorized packet until the appeal window opens, then print, mail and provide tracking.</p>${notes('explanation', 'Your explanation and why your evidence supports the requested value', intake.explanation || (intake.reason && intake.reason !== 'uniformity' ? '' : 'I request review of my property assessment for uniformity. My selected comparable properties and supporting records are included for consideration.'))}<fieldset><legend>Which documents apply?</legend>${toggle('ownResidence','I live at this property as my own residence (leave unchecked for a rental).',intake.ownResidence)}${toggle('recentSale','There was a sale within two years before the assessment lien date, or I am relying on a sale.',intake.recentSale)}<div class="packet-sale-fields" ${intake.recentSale?'':'hidden'}>${input('purchaseDate','Purchase date','date',intake.purchaseDate || '')}${input('purchasePrice','Purchase price ($)','number',intake.purchasePrice || '', 'min="1" step="0.01"')}${input('sellerName','Seller name','text',intake.sellerName || '')}${input('saleRelationship','Relationship between buyer and seller (or none)','text',intake.saleRelationship || '')}</div>${toggle('appraisal','An existing appraisal / valuation report falls within the required disclosure period.',intake.appraisal)}${toggle('damage','My argument relies on damage, condition or vacancy.',intake.damage)}<details><summary>Additional attestation (only if requested)</summary>${toggle('affidavit','The Assessor requested an additional attestation for this appeal.',intake.affidavit)}<label>Facts for a requested attestation (only if applicable)<textarea name="attestationFacts" maxlength="10000">${escape(intake.attestationFacts || '')}</textarea></label></details></fieldset>${comparisonChoices(snapshot,intake)}${check('recordsConfirmed','I verified the assessment year, ownership, all PINs and current values against the county record. Imported data may be from an earlier year.')}${check('singleFamilyScope','This is a single-family home with one dwelling unit, not a condo, multi-family, mixed-use or commercial property.')}${check('individualOwner', 'The property is titled in my individual name. I will review and sign my prepared appeal.')}${check('noExistingAppeal', 'I have checked for existing appeals and representation; there is no conflicting filing or engagement.')}`, 'Save information');
    }
    if(intake.ownerName && !guided) html += checklistCard(s);
    if(guided)html+=`<section class="packet-card packet-question-launch"><div><span class="section-badge">One question at a time</span><h2>Let’s prepare your appeal</h2><p>Confirm the details we already have, answer a few questions, and add only the evidence that applies. We assemble your answers and the available signature forms into your PDF.</p><button type="button" class="btn btn-primary" id="open-appeal-questions">${s.questionnaire || s.intake?.ownerName?'Continue my appeal':'Start questions'}</button><p class="packet-muted">Progress saves to your account. Preparation and downloads are free.</p></div><div class="packet-question-illustration" aria-hidden="true"><span>01</span><span>02</span><span>PDF</span></div></section><div id="appeal-question-host"></div>`;
    if(isOwner && free && editable && storageReady) {
        const prepared=!guided && s.documents.find(doc=>doc.kind==='packet' && doc.version===s.version && (!s.packetId || doc.id===s.packetId));
        html+=`<section class="packet-card" id="free-packet-download"><h2>Your free packet</h2><p>Downloads never require payment.</p>${prepared?`<button type="button" class="btn btn-primary" data-document="${escape(prepared.id)}">Download free packet</button>`:'<p>You can download your collected information and uploads now. The preparation copy lists missing forms or evidence and is marked not ready to file.</p><button type="button" class="btn btn-primary" id="download-preparation-copy">Download free preparation copy</button>'}</section>`;
    }
    html += `<section class="packet-card"><h2>Your documents and downloads</h2>${s.documents.map(doc => `<div class="packet-document"><span>${escape(doc.name)}<br><small>${escape(evidenceCategories[doc.category] || doc.kind.replaceAll('_',' '))} · version ${doc.version}</small></span><button type="button" class="btn btn-secondary" data-document="${doc.id}">Download</button>${isOwner && preparing && doc.kind==='evidence'?`<button type="button" class="btn btn-secondary" data-remove="${doc.id}">Remove</button>`:''}</div>`).join('') || '<p>No documents uploaded yet.</p>'}</section>`;
    if (editable && !guided && storageReady && ['intake','preparing'].includes(s.status)) html += form('evidence', 'Add supporting evidence', `<label>Document type<select name="category">${Object.entries(evidenceCategories).filter(([id])=>!['application','affidavit'].includes(id)).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><label>Photo date (for a property photo)<input type="date" name="photoDate"></label><label><input type="checkbox" name="photoDateStamped" value="yes">The photo visibly shows its capture date. Otherwise we prepare the official date attestation for you to sign.</label>${file('PDF, JPG or PNG',true)}<p>Upload complete, legible documents. Uploaded files are included in the combined PDF; remove outdated files before building.</p>`, 'Upload evidence');
    if (isOwner && editable && s.status === 'review') html += form('approve', 'Review your prepared packet', `<p>Download the current packet above and check every field and supporting document. Contact us for corrections before approving.</p>${check('confirmed','I reviewed this packet version and confirm that its information is accurate. I selected my appeal grounds and requested value. This approval is not my appeal signature.')}`, 'Confirm reviewed packet');
    if (s.status === 'awaiting_signature') html += '<section class="packet-card"><h2>Sign your documents</h2><p>Use the invitation sent directly by DocuSign. After all required signers complete it, we will verify and upload the signed packet and completion certificate.</p></section>';
    if (isOwner && editable && s.status === 'signed' && !s.mailingConsent) html += form('authorize_mail', 'Authorize mailing', `<p>Download and review the signed packet above. We will check the agency’s filing requirements before dispatch. The $49 fulfillment price includes DocuSign signing, printing, assembly, postage and tracking.</p>${check('confirmed','I authorize Cook County Tax Compare to mail this signed packet version as instructed. I understand that mailing does not guarantee timely county filing or a reduced assessment.')}`, 'Authorize mailing this packet');
    if (s.delivery) html += `<section class="packet-card"><h2>Postal delivery</h2><p>Carrier delivery recorded ${escape(s.delivery.deliveredOn)}. This is not county filing confirmation.</p></section>`;
    if (s.mailingConsent && !s.mailing) html += mailingQueueCard(current.mailingWindow, free);
    if (s.mailing) html += `<section class="packet-card"><h2>Mailing record</h2><p>${escape(s.mailing.carrier)} · ${escape(s.mailing.tracking)} · Mailed ${escape(s.mailing.mailedOn)}</p><pre>${escape(s.mailing.recipient)}</pre><p>Recorded filing deadline: ${escape(s.mailing.filingDeadline)}</p></section>`;
    if (s.filing) html += `<section class="packet-card"><h2>County confirmation</h2><p>Docket: ${escape(s.filing.docket)} · Confirmed ${escape(s.filing.confirmedOn)}</p></section>`;
    if (isOwner && free && !guided && s.status==='preparing' && storageReady) {
        const missing=preparationProblems(s);
        if(!current.officialForms?.length || current.officialForms.some(form=>!form.ready)) html += '<section class="packet-card"><h2>Official form setup in progress</h2><p>Your saved information and uploads are retained. The preparation desk will supply the official forms for this year. You do not need to download or upload blank forms.</p></section>';
        else html += form('generate','Build your appeal packet',`<p>We prefill and include the official application and any applicable official attestations, your statement, property records, comparison exhibit and supporting uploads in one PDF. Review the completed packet before signing.</p>${missing.length?`<p>Still needed: ${missing.map(escape).join('; ')}</p>`:'<p>Your checklist is complete. Build the packet, then review every page.</p>'}`,'Build PDF for review');
    }
    if (isOwner && ['review','approved'].includes(s.status)) html += `<section class="packet-card"><h2>Submit it yourself · Free</h2><p>Download your packet, complete every required signature and any notarization, and submit through the Assessor’s accepted filing channel before your township deadline. If filing online, enter your application in SmartFile and upload the appropriate evidence.</p><a class="btn btn-secondary" href="https://www.cookcountyassessoril.gov/online-appeals" target="_blank" rel="noopener">Open Assessor online appeals</a><p>Keep the county’s confirmation number and submitted copy. A download or mailing receipt does not confirm county filing.</p></section>`;
    if (isOwner && free && ['review','approved'].includes(s.status) && !signature) html += form('revise','Make corrections','<p>Return to preparation; approval resets.</p>','Edit my packet');
    if (isOwner && free && editable && intake.singleFamilyScope===true && s.status==='approved' && !fulfillmentPaid) html += form('purchase','Optional DocuSign + print and mail · $49',`<p>You can download your packet above and submit it yourself for free. Fulfillment includes DocuSign signing, printing, assembly, postage and tracking for this version. It does not guarantee county acceptance or a reduction.</p><p>Demo pilot: signature acceptance is assumed for testing and has not been confirmed by the Assessor. Demo signing cannot be dispatched as a real appeal.</p>${check('fulfillmentAccepted','I choose the optional $49 fulfillment service for this approved packet version.')}`,'Continue to fulfillment checkout');
    if (free && fulfillmentPaid) html += `<section class="packet-card"><h2>DocuSign signing included</h2><p>${signature ? `Envelope status: ${escape(signature.status)} · ${escape(signature.environment)}` : 'The fulfillment desk will check signature placement and send your invitation.'}</p><p>Use the signing link delivered by DocuSign to your verified account email. Signed files and the completion certificate will appear here after synchronization.</p></section>`;
    if (free && signature?.envelope_id && ['approved','awaiting_signature','signed'].includes(s.status)) html += form('ds_sync','Check signing status','<p>Checks are limited to once every 15 minutes. Completed documents are retrieved directly from DocuSign.</p>','Check DocuSign');
    if (isAdmin && editable) html += guided ? `<details class="packet-card"><summary>Administrator preparation tools</summary>${adminForms(s, storageReady, free, fulfillmentPaid, signature)}</details>` : adminForms(s, storageReady, free, fulfillmentPaid, signature);
    if(isOwner && free && editable && current.checkout?.testing) html+=form('payment_test','Test existing Stripe checkout · $49',`<p>${current.checkout.mode==='live'?'This uses your existing live Stripe setup and charges the card $49.':'This uses Stripe test mode.'} This administrator payment test does not order DocuSign or mailing and does not replace approval of the completed packet.</p>${check('testPaymentAccepted','I want to run this $49 payment test using the existing Stripe checkout.')}`,'Continue to Stripe payment test');
    html += `<section class="packet-card"><h2>Activity</h2><ul>${events.map(event => `<li>${escape(event.created_at)} UTC — ${escape(event.action.replaceAll('_',' '))}: ${escape(labels[event.status])}</li>`).join('') || '<li>Workspace created. Intake has not been submitted.</li>'}</ul></section>`;
    const workspace = document.getElementById('packet-workspace');
    if(guided) {
        html=html.replace('<section class="packet-card"><h2>Your documents and downloads</h2>','<details class="packet-card"><summary>Saved documents and previous downloads</summary><div>');
        const documentsEnd=html.indexOf('</section>',html.indexOf('<summary>Saved documents and previous downloads</summary>'));
        html=html.slice(0,documentsEnd)+'</div></details>'+html.slice(documentsEnd+10);
        html=html.replace('<section class="packet-card"><h2>Activity</h2>','<details class="packet-card"><summary>Activity</summary><div>');
        const activityEnd=html.indexOf('</section>',html.indexOf('<summary>Activity</summary>'));
        html=html.slice(0,activityEnd)+'</div></details>'+html.slice(activityEnd+10);
    }
    workspace.innerHTML = html; workspace.hidden = false;
    if(guided) {
        questionController=createQuestionController(workspace.querySelector('#appeal-question-host'));
        workspace.querySelector('#open-appeal-questions').addEventListener('click',()=>questionController.open());
        if(openQuestionsOnLoad){openQuestionsOnLoad=false;questionController.open();}
    }

    const reasonSelect=workspace.querySelector('[name="reason"]'), explanation=workspace.querySelector('[name="explanation"]');
    const uniformityDraft='I request review of my property assessment for uniformity. My selected comparable properties and supporting records are included for consideration.';
    if(reasonSelect && explanation)reasonSelect.addEventListener('change',()=>{if(explanation.value===uniformityDraft || !explanation.value.trim())explanation.value=reasonSelect.value==='uniformity'?uniformityDraft:'';});
    const saleToggle=workspace.querySelector('[name="recentSale"]'), saleFields=workspace.querySelector('.packet-sale-fields');
    if(saleToggle && saleFields) {
        const syncSale=()=>{saleFields.hidden=!saleToggle.checked;for(const el of saleFields.querySelectorAll('input'))el.disabled=!saleToggle.checked;};
        saleToggle.addEventListener('change',syncSale);syncSale();
    }
    workspace.querySelectorAll('form[data-action]').forEach(el => el.addEventListener('submit', submit));
    workspace.querySelectorAll('[name="selectedComparables"]').forEach(box=>box.addEventListener('change',()=>{if(workspace.querySelectorAll('[name="selectedComparables"]:checked').length>MAX_APPEAL_COMPARISONS){box.checked=false;message('Choose up to five comparisons. Uncheck one before choosing another.',true);}}));
    workspace.querySelectorAll('[data-remove]').forEach(el=>el.addEventListener('click',async()=>{el.disabled=true;try{const r=await authFetch(`/api/packet?id=${encodeURIComponent(selectedId)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'remove_evidence',documentId:el.dataset.remove,revision:current.revision})});const d=await r.json();if(!r.ok)throw new Error(d.error);await load();}catch(e){message(e.message,true);el.disabled=false;}}));
    workspace.querySelectorAll('[data-document]').forEach(el => el.addEventListener('click', () => download(el.dataset.document)));
    workspace.querySelector('#download-preparation-copy')?.addEventListener('click',async event=>{
        const button=event.currentTarget;button.disabled=true;
        try{await downloadFile(`/api/packet?id=${encodeURIComponent(selectedId)}&download=preparation`,'assessor-preparation-copy.pdf');}
        catch(error){message(error.message,true);}finally{button.disabled=false;}
    });
}

function createQuestionController(host) {
    const id=selectedId,revision=sessionRevision;
    const active=()=>{if(revision!==sessionRevision || id!==selectedId)throw new Error('Your account or packet changed. Please reopen your appeal.');};
    const post=async (data,file)=>{
        active();let body,headers;
        if(file){body=new FormData();body.set('data',JSON.stringify({...data,revision:current.revision}));body.set('file',file);}
        else {body=JSON.stringify({...data,revision:current.revision});headers={'Content-Type':'application/json'};}
        const result=await requestJSON(`/api/packet?id=${encodeURIComponent(id)}`,{method:'POST',headers,body},'Could not save your answer.');active();return result;
    };
    const refresh=async()=>{const data=await requestJSON(`/api/packet?id=${encodeURIComponent(id)}`);active();current=data;return data;};
    return mountAppealQuestions(host,current,{
        async saveDraft(answers,step){const result=await post({action:'questionnaire',answers,step});current={...current,revision:result.revision,state:{...current.state,questionnaire:result.questionnaire}};},
        async saveIntake(answers){await post({...answers,action:'intake',agency:'assessor',taxYear:current.state.intake?.taxYear || current.state.taxYear,condo:false});return refresh();},
        async upload({file,...data}){await post({...data,action:'evidence'},file);return refresh();},
        async download(){active();await downloadFile(`/api/packet?id=${encodeURIComponent(id)}&download=preparation`,'assessor-preparation-copy.pdf');},
        async generate(){
            await post({action:'generate'});await refresh();
            try {await downloadFile(`/api/packet?id=${encodeURIComponent(id)}&document=${encodeURIComponent(current.state.packetId)}`,'assessor-appeal.pdf');}
            catch(error) {
                if(revision===sessionRevision && id===selectedId){render();message(`Your PDF is saved. ${error.message} Use Download free packet to try again.`,true);document.querySelector('#free-packet-download button')?.focus();}
                throw error;
            }
        },
        chooseProperty(){location.href='index.html#user-dashboard';},
        finish(){if(revision===sessionRevision){render();message('Your answers and documents are saved.');(document.getElementById('open-appeal-questions') || document.querySelector('#free-packet-download button'))?.focus();}}
    });
}

function mailingQueueCard(window, free) {
    if (!free) return '<section class="packet-card"><p>You authorized mailing this signed packet. Awaiting dispatch confirmation.</p></section>';
    const titles = {open:'Ready for print and mail',upcoming:'Waiting for the appeal window to open',closed:'Appeal window closed',unannounced:'Waiting for the township appeal calendar'};
    const descriptions = {
        open:'Your signed packet is authorized for mailing. We will print, assemble and mail it during the open appeal window, then provide tracking.',
        upcoming:'Your signed packet is authorized and on hold. We will print, assemble and mail it once your township appeal window opens, then provide tracking.',
        closed:'The appeal window for this assessment year has closed. The fulfillment desk must resolve timing before mailing. Your packet will not be sent outside the open window.',
        unannounced:'Your signed packet is authorized and on hold. We will manage the township calendar and mail once the appeal window for this assessment year is published and open.'
    };
    const status = window?.status || 'unannounced';
    return `<section class="packet-card" id="packet-mailing-queue"><h2>${titles[status] || titles.unannounced}</h2><p>${descriptions[status] || descriptions.unannounced}</p></section>`;
}

function adminForms(s, storageReady, free, paid, signature) {
    let html = '<section class="packet-card"><h2>Preparation desk</h2><p><a href="official-forms.html">Manage reusable official Assessor forms</a></p><p>Prepare the packet using current official forms and the customer’s evidence. For paid fulfillment, create a DocuSign draft, preview signature positions in your DocuSign account, then send through this service. Standard signing does not notarize documents.</p></section>';
    if (s.status === 'preparing' && storageReady) html += form('packet', 'Upload packet for owner review', file('Complete prepared packet PDF'), 'Publish packet for review');
    if (['review','approved','awaiting_signature','signed'].includes(s.status) && (!free || !signature || signature.status==='voided')) html += form('revise','Return packet for corrections', `${s.envelopeId ? check('envelopeVoided','I voided the previous DocuSign envelope so it cannot be used for the revised packet.') : ''}<p>Previous approval and mailing authorization will be cleared. The customer must review the new version.</p>`, 'Return to preparation');
    if (!free && s.status === 'approved') html += form('request_signature','Record DocuSign invitation', `${input('envelopeId','Envelope ID from DocuSign')}${notes('reviewNotes','Agency acceptance and notarization review')}${check('acceptanceChecked','I checked acceptance of the signature method and any notarization requirement, and sent the approved packet to the correct owner in DocuSign.')}`, 'Record signature request');
    if (!free && s.status === 'awaiting_signature') {
        html += `<section class="packet-card"><p>DocuSign envelope: ${escape(s.envelopeId)}</p></section>`;
        if (storageReady) html += form('signed_packet','Upload completed signed packet',file(),'Upload signed packet') + form('certificate','Upload DocuSign completion certificate',file(),'Upload certificate');
        html += form('confirm_signed','Verify completed signatures',check('completionVerified','I verified the completed envelope, signer identities, correct packet version, and any required notarization against the uploaded documents.'),'Mark signatures verified');
    }
    if (s.status === 'signed' && s.mailingConsent && storageReady && (!free || (paid && signature?.environment==='production' && current.mailingWindow?.status==='open'))) html += form('mail','Record dispatched mailing', `${input('recipient','Receiving agency and full mailing address')}${input('carrier','Carrier / service', 'text', 'USPS Certified Mail')}${input('tracking','Tracking number')}<div class="packet-grid">${input('mailedOn','Actual mailing date','date')}${free ? `<p>Township mailing window: ${escape(current.mailingWindow.opensOn)} through ${escape(current.mailingWindow.closesOn)}</p>` : input('filingDeadline','Verified filing deadline','date')}</div>${notes('reviewNotes','Source and review of current mailing, timeliness, copies, signature, and representation requirements')}${file('Postal acceptance / mailing proof PDF')}${check('rulesChecked','I verified the current requirements and mailed the authorized, signed packet with all required copies. I checked whether receipt or postmark controls timeliness.')}`, 'Record mailing');
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
        if(data.action==='purchase' || data.action==='payment_test' || data.action.startsWith('ds_')) {
            const signing=data.action.startsWith('ds_');
            if(data.action==='payment_test'){if(data.testPaymentAccepted!==true)throw new Error('Confirm the payment test first.');data.paymentTest=true;data.fulfillmentAccepted=true;}
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

async function downloadFile(url,filename) {
    const response=await authFetch(url);
    if(!response.ok) {const result=await response.json().catch(()=>null);throw new Error(result?.error || 'Could not download the packet. Please try again.');}
    if(!(response.headers.get('Content-Type') || '').includes('application/pdf'))throw new Error('The download did not return a PDF. Please try again.');
    const disposition=response.headers.get('Content-Disposition') || '';
    const name=/filename="([^"\\/]+)"/.exec(disposition)?.[1] || filename;
    const objectUrl=URL.createObjectURL(await response.blob()),link=document.createElement('a');
    link.href=objectUrl;link.download=name;document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
}
async function download(id) {
    try {await downloadFile(`/api/packet?id=${encodeURIComponent(selectedId)}&document=${encodeURIComponent(id)}`,current.state.documents.find(doc=>doc.id===id)?.name || 'document.pdf');}
    catch(error){message(error.message,true);}
}

function propertySummary(snapshot) {
    const d=snapshot.details || {};
    return `<section class="packet-card"><h2>1. Review your saved property</h2><p>${escape(snapshot.source)}</p><dl>${[['PINs',snapshot.pin],['Township',d.townshipName],['Class',d.classCode],['Building area',d.homeSize ? `${d.homeSize} sq ft`:null],['Year built',d.yearBuilt],['Implied market value',money(impliedMarketValue(d.taxableValue))],['Last appeal',d.lastAppealYear]].map(([label,value])=>`<dt>${label}</dt><dd>${escape(value??'Not available')}</dd>`).join('')}</dl><p>Implied market value = assessed value ÷ 0.10 for Class 2 residential property.</p>${snapshot.warning?`<p>${escape(snapshot.warning)}</p>`:''}</section>`;
}
function comparisonChoices(snapshot,intake) {
    const comparisons=lowerValuationComparables(snapshot),selected=(intake.selectedComparables || comparisons.map(item=>String(item.pin))).filter(pin=>comparisons.some(c=>String(c.pin)===pin)).slice(0,MAX_APPEAL_COMPARISONS);
    return `<fieldset><legend>Your assessment comparisons</legend><p>Your property's implied market value is ${escape(money(impliedMarketValue(snapshot.details?.taxableValue)))}. We suggest up to five similar properties with lower assessed values. Uniformity claims need at least three comparisons; five are recommended. You may upload your own comparison exhibit instead.</p>${comparisons.map(c=>`<label class="packet-comparison"><input type="checkbox" name="selectedComparables" value="${escape(c.pin)}" ${selected.includes(String(c.pin))?'checked':''}><strong>${escape(c.address)}</strong><br>PIN ${escape(c.pin)} · Class ${escape(c.classCode)} · ${escape(c.homeSize??'?')} sq ft · Built ${escape(c.yearBuilt??'?')} · Implied market value ${escape(money(impliedMarketValue(c.taxableValue)))}</label>`).join('')||'<p>No comparisons with a lower assessed value are available. Upload your comparison exhibit with PINs and supporting records.</p>'}<p>Implied market value = assessed value ÷ 0.10. These are assessment comparisons, not sale prices; review similarity and meaningful differences.</p></fieldset>`;
}
function additionalOwnerFields(forms,intake) {
    const fields=new Map();
    for(const form of forms || []) for(const value of form.missingValues || []) {
        if(['mailingCity','mailingState','mailingZip','propertyCity','propertyZip','purchaseDate','sellerName','saleRelationship'].includes(value.source)) fields.set(value.source,value.label);
    }
    for(const key of ['mailingCity','mailingState','mailingZip','propertyCity','propertyZip','purchaseDate','sellerName','saleRelationship']) if(intake[key])fields.set(key,key.replace(/([A-Z])/g,' $1'));
    return [...fields].map(([key,label])=>input(key,label,key==='purchaseDate'?'date':'text',intake[key] || '')).join('');
}
function checklistCard(state) {
    const forms=current.officialForms || [];
    const pending=!forms.length || forms.some(form=>!form.ready);
    return `<section class="packet-card"><h2>2. We prepare your forms and supporting packet</h2><p>We prefill the official Assessor application and applicable official attestations using the information you confirm. Your property summary and selected comparison exhibit are included automatically. You only supply missing facts, necessary evidence and required signatures.</p>${pending?'<p>The preparation desk is obtaining the official template for this year. You can save your information and evidence now; you do not need to find or upload blank forms.</p>':''}<ol class="packet-checklist">${requirements(state).map(r=>`<li><strong>${r.providedBy==='service'?'We prepare':r.done?'Added':'Upload if applicable'}: ${escape(r.title)}</strong><p>${escape(r.detail)}</p><small>${escape(r.signature)}</small></li>`).join('')}</ol><p>Single-family homes with one dwelling unit only. Review the prepared forms and attachments before signing. Existing appraisals, closing records and required photos must come from you when they apply.</p></section>`;
}
