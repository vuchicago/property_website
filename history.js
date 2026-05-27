import { auth, authFetch } from './auth-client.js';

let userAddresses = [];
let allAppeals = [];
let lookupTimer = null;
let selectedAddressSuggestion = '';
let selectedPropertyKeySuggestion = '';
let currentSuggestions = [];
let selectedAddressForImage = '';
let selectedPinForImage = '';
let dashboardUser = null;
let accountNotifications = [];
const CURRENT_TAX_YEAR = 2024;
const CURRENT_STATE_EQUALIZER = 3.0355;
const ASSESSED_VALUE_DISPLAY_MULTIPLIER = 10;
const DASHBOARD_CACHE_VERSION = '20260522-appeal-window';
const MAX_SUPPORTING_DOCUMENTS = 5;
const SUPPORTING_DOCUMENT_ACCEPT = 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp';

export async function loadAppealHistory(userOverride = null) {
        const user = userOverride || auth.currentUser;
        if (!user) return;
        dashboardUser = user;

        setupAddAddressForm();
        setupPropertyImageUpload();
        setupGovernmentIdUpload();
        setupSupportingDocumentsUpload();
        setupCompletedAppealsPanel();
        setupAccountInbox();
        renderAccountSummary(user);

        const hadCache = loadDashboardCache(user.uid);
        if (hadCache) {
                renderAccountSummary(user);
                renderAddressList();
        } else {
                renderAddressLoadingState();
        }

        await fetchAddresses();
        saveDashboardCache(user.uid);
        renderAccountSummary(user);
        renderAddressList();

        await fetchAppeals();
        await fetchAccountNotifications();
        saveDashboardCache(user.uid);

        renderAccountSummary(user);
        renderAccountInbox();
        renderCompletedAppealsPanel();
        renderAddressList();
}

async function fetchAddresses() {
        try {
                const response = await dashboardAuthFetch('/api/addresses');
                if (!response.ok) throw new Error('Failed to fetch addresses');
                userAddresses = await response.json();
        } catch (error) {
                console.error("Error fetching addresses:", error);
        }
}

function dashboardCacheKey(uid) {
        return `ctc-dashboard:${DASHBOARD_CACHE_VERSION}:${uid}`;
}

function loadDashboardCache(uid) {
        try {
                const raw = window.localStorage.getItem(dashboardCacheKey(uid));
                if (!raw) return false;

                const cached = JSON.parse(raw);
                if (!Array.isArray(cached.userAddresses) || !Array.isArray(cached.allAppeals)) {
                        return false;
                }

                userAddresses = cached.userAddresses;
                allAppeals = cached.allAppeals;
                return true;
        } catch (error) {
                console.warn('Could not load dashboard cache:', error);
                return false;
        }
}

function saveDashboardCache(uid) {
        try {
                window.localStorage.setItem(dashboardCacheKey(uid), JSON.stringify({
                        cachedAt: Date.now(),
                        userAddresses,
                        allAppeals
                }));
        } catch (error) {
                console.warn('Could not save dashboard cache:', error);
        }
}

async function dashboardAuthFetch(url, options = {}) {
        if (!dashboardUser) {
                return authFetch(url, options);
        }

        const user = auth.currentUser || dashboardUser;
        const token = await user.getIdToken();
        const headers = new Headers(options.headers || {});
        headers.set('Authorization', `Bearer ${token}`);
        headers.set('X-Firebase-Auth', token);

        return fetch(url, {
                ...options,
                headers
        });
}

async function fetchAppeals() {
        try {
                const response = await dashboardAuthFetch('/api/history');
                if (!response.ok) throw new Error('Failed to fetch appeals');
                allAppeals = await response.json();
        } catch (error) {
                console.error("Error fetching appeals:", error);
        }
}

async function fetchAccountNotifications() {
        try {
                const response = await dashboardAuthFetch('/api/notifications');
                if (!response.ok) throw new Error('Failed to fetch notifications');
                const data = await response.json();
                accountNotifications = Array.isArray(data.notifications) ? data.notifications : [];
        } catch (error) {
                console.error('Error fetching account notifications:', error);
                accountNotifications = [];
        }
}

function renderAccountSummary(user) {
        const emailEl = document.getElementById('account-email');
        const propertyCountEl = document.getElementById('property-count');
        const appealCountEl = document.getElementById('appeal-count');
        const pendingCountEl = document.getElementById('pending-appeal-count');
        const email = user?.email || user?.providerData?.find(provider => provider.email)?.email || 'Signed in';

        if (emailEl) emailEl.textContent = email;
        if (propertyCountEl) propertyCountEl.textContent = userAddresses.length;
        if (appealCountEl) {
                appealCountEl.textContent = completedAppeals().length;
        }
        if (pendingCountEl) {
                pendingCountEl.textContent = allAppeals.filter(appeal => (appeal.appealStatus || appeal.status || '').toLowerCase() === 'pending').length;
        }
}

function setupAccountInbox() {
        const markReadBtn = document.getElementById('account-inbox-mark-read');
        if (!markReadBtn || markReadBtn.dataset.bound === 'true') return;
        markReadBtn.dataset.bound = 'true';
        markReadBtn.addEventListener('click', async () => {
                await dashboardAuthFetch('/api/notifications', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({})
                });
                await fetchAccountNotifications();
                renderAccountInbox();
        });
}

function renderAccountInbox() {
        const panel = document.getElementById('account-inbox-panel');
        const list = document.getElementById('account-inbox-list');
        if (!panel || !list) return;

        if (!accountNotifications.length) {
                panel.style.display = 'none';
                list.innerHTML = '';
                return;
        }

        panel.style.display = 'block';
        list.innerHTML = accountNotifications.map(item => `
                <article class="account-inbox-item ${item.is_read ? '' : 'unread'}">
                        <strong>${escapeHtml(item.title || 'Message')}</strong>
                        <span class="text-sm text-muted">${escapeHtml(item.created_at ? new Date(item.created_at).toLocaleString() : '')}</span>
                        <p class="text-sm">${escapeHtml(item.message || '')}</p>
                </article>
        `).join('');
}

function setupCompletedAppealsPanel() {
        const tile = document.getElementById('completed-appeals-tile');
        const panel = document.getElementById('completed-appeals-panel');
        const closeBtn = document.getElementById('completed-appeals-close');
        if (!tile || !panel || tile.dataset.bound === 'true') return;
        tile.dataset.bound = 'true';

        const openPanel = () => {
                renderCompletedAppealsPanel();
                panel.classList.add('active');
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        tile.addEventListener('click', openPanel);
        tile.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openPanel();
                }
        });

        closeBtn?.addEventListener('click', () => {
                panel.classList.remove('active');
        });
}

function completedAppeals() {
        return allAppeals.filter(appeal => {
                const status = String(appeal.appealStatus || appeal.status || '').toLowerCase();
                return status === 'finished' || status === 'completed' || status === 'complete';
        });
}

function renderCompletedAppealsPanel() {
        const list = document.getElementById('completed-appeals-list');
        if (!list) return;

        const appeals = completedAppeals();
        if (!appeals.length) {
                list.innerHTML = '<p class="text-sm text-muted">No completed appeals yet.</p>';
                return;
        }

        list.innerHTML = appeals.map(appeal => {
                const paidAt = appeal.paymentDate ? new Date(appeal.paymentDate).toLocaleDateString() : 'N/A';
                const appealedAt = appeal.appealDate ? new Date(appeal.appealDate).toLocaleDateString() : 'N/A';
                const handledBy = appeal.completedByEmail || appeal.assignedPartnerEmail || appeal.assignedByAdminEmail || 'Not assigned';
                const amount = appeal.amount ? `$${(appeal.amount / 100).toFixed(2)}` : 'N/A';

                return `
                        <article class="completed-appeal-row">
                                <strong>${escapeHtml(appeal.propertyAddress || 'Property')}</strong>
                                <span class="text-sm text-muted">Paid ${escapeHtml(paidAt)} · ${escapeHtml(amount)}</span>
                                <span class="text-sm text-muted">Appealed ${escapeHtml(appealedAt)} · By ${escapeHtml(handledBy)}</span>
                        </article>
                `;
        }).join('');
}

function renderAddressList() {
        const listContainer = document.getElementById('address-list');
        if (!listContainer) return;

        if (userAddresses.length === 0) {
                listContainer.innerHTML = '<li class="text-sm text-muted">No addresses added yet.</li>';
                showEmptyDetailsPanel();
                return;
        }

        let html = '';
        userAddresses.forEach(addrObj => {
                // Count appeals for this address
                const propertyAppeals = appealsForProperty(addrObj);
                const appealCount = propertyAppeals.length;
                const propertyStatus = propertyAppealStatus(propertyAppeals);
                const canDelete = appealCount === 0;

                const safeAddress = escapeHtml(addrObj.address);
                const safePropertyKey = escapeHtml(addrObj.property_key || addrObj.propertyKey || addrObj.address);

                html += `
            <li class="address-item" style="padding: 1rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s;" data-address="${safeAddress}" data-property-key="${safePropertyKey}">
                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem;">
                        <div>
                                <div style="font-weight: 500; margin-bottom: 0.25rem;">${safeAddress}</div>
                                ${addrObj.pin ? `<div class="text-xs text-muted">${String(addrObj.pin).includes(',') ? 'PINs' : 'PIN'} ${escapeHtml(addrObj.pin)}</div>` : ''}
                                ${addrObj.propertyDetails?.mailingName ? `<div class="text-xs text-muted">${escapeHtml(addrObj.propertyDetails.mailingName)}</div>` : ''}
                                <div class="text-xs text-muted">${appealCount} appeal(s)</div>
                                ${propertyStatus ? renderPropertyAppealStatus(propertyStatus) : ''}
                        </div>
                        ${canDelete ? `<button type="button" class="btn btn-secondary btn-sm delete-address-btn" data-address="${safeAddress}" data-property-key="${safePropertyKey}" aria-label="Delete ${safeAddress}">Delete</button>` : ''}
                </div>
            </li>
        `;
        });

        listContainer.innerHTML = html;

        // Add click event listeners
        listContainer.querySelectorAll('.address-item').forEach(item => {
                item.addEventListener('click', (e) => {
                        if (e.target.closest('.delete-address-btn')) {
                                return;
                        }

                        // Remove active class from all
                        listContainer.querySelectorAll('.address-item').forEach(i => i.style.borderColor = 'var(--border-color)');
                        listContainer.querySelectorAll('.address-item').forEach(i => i.style.background = 'transparent');

                        // Add active class to clicked
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.background = 'var(--bg-secondary)';

                        const propertyKey = e.currentTarget.dataset.propertyKey;
                        selectAddress(propertyKey);
                });
        });

        listContainer.querySelectorAll('.delete-address-btn').forEach(button => {
                button.addEventListener('click', async (event) => {
                        event.stopPropagation();
                        const address = event.currentTarget.dataset.address;
                        const propertyKey = event.currentTarget.dataset.propertyKey;
                        if (!address && !propertyKey) return;

                        await deleteAddress(address, propertyKey);
                });
        });
}

function renderAddressLoadingState() {
        const listContainer = document.getElementById('address-list');
        if (!listContainer) return;

        listContainer.innerHTML = `
                <li class="address-loading-row"></li>
                <li class="address-loading-row short"></li>
                <li class="address-loading-row"></li>
        `;

        const detailsPanel = document.getElementById('appeal-details-container');
        const emptyPanel = document.getElementById('no-address-selected-msg');
        if (detailsPanel) detailsPanel.style.display = 'none';
        if (emptyPanel) {
                emptyPanel.style.display = 'flex';
                emptyPanel.textContent = 'Loading your properties...';
        }
}

function propertyKeyOf(item) {
        return item?.property_key || item?.propertyKey || '';
}

function appealsForProperty(property) {
        if (!property) return [];
        const key = propertyKeyOf(property);
        const address = property.address || '';
        return allAppeals.filter(appeal => {
                if (key && appeal.propertyKey) {
                        return appeal.propertyKey === key;
                }
                return appeal.propertyAddress === address;
        });
}

function propertyAppealStatus(appeals) {
        if (!appeals.length) return '';
        if (appeals.some(appeal => String(appeal.paymentStatus || '').toLowerCase() === 'refunded')) {
                return 'Refunded';
        }
        if (appeals.some(appeal => String(appeal.appealStatus || appeal.status || '').toLowerCase() === 'pending')) {
                return 'Pending';
        }
        if (appeals.some(appeal => ['finished', 'completed', 'complete'].includes(String(appeal.appealStatus || appeal.status || '').toLowerCase()))) {
                return 'Completed';
        }
        return capitalize(String(appeals[0].appealStatus || appeals[0].status || 'Appeal'));
}

function renderPropertyAppealStatus(status) {
        const normalized = String(status || '').toLowerCase();
        const statusClass = normalized === 'pending'
                ? 'property-appeal-status-pending'
                : normalized === 'refunded'
                        ? 'property-appeal-status-refunded'
                        : 'property-appeal-status-completed';
        return `
                <div class="property-appeal-status ${statusClass}">
                        <span aria-hidden="true"></span>
                        Appeal Status: ${escapeHtml(status)}
                </div>
        `;
}

async function deleteAddress(address, propertyKey) {
        const confirmed = window.confirm(`Delete ${address} from My Properties?`);
        if (!confirmed) return;

        try {
                const response = await dashboardAuthFetch('/api/addresses', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ address, propertyKey })
                });

                if (!response.ok) {
                        const err = await response.json();
                        alert(`Failed to delete address: ${err.error}`);
                        return;
                }

                await fetchAddresses();
                if (dashboardUser) saveDashboardCache(dashboardUser.uid);
                renderAccountSummary(dashboardUser || auth.currentUser);
                renderAddressList();
        } catch (error) {
                console.error('Error deleting address:', error);
                alert('An error occurred while deleting the address.');
        }
}

function showEmptyDetailsPanel() {
        const detailsPanel = document.getElementById('appeal-details-container');
        const emptyPanel = document.getElementById('no-address-selected-msg');

        if (detailsPanel) detailsPanel.style.display = 'none';
        if (emptyPanel) {
                emptyPanel.style.display = 'flex';
                emptyPanel.textContent = 'Add a property to start tracking appeal activity.';
        }
}

function selectAddress(propertyKey) {
        const selectedAddress = userAddresses.find(item => (item.property_key || item.propertyKey || item.address) === propertyKey);
        const address = selectedAddress?.address || '';
        selectedAddressForImage = address;
        selectedPinForImage = '';
        document.getElementById('no-address-selected-msg').style.display = 'none';
        const detailsPanel = document.getElementById('appeal-details-container');
        detailsPanel.style.display = 'block';

        document.getElementById('selected-address-title').textContent = address;
        const details = selectedAddress?.propertyDetails;
        const taxContext = taxContextForDisplay(details);
        const pinEl = document.getElementById('selected-address-pin');
        const filteredAppeals = appealsForProperty(selectedAddress);
        const selectedAppealStatus = propertyAppealStatus(filteredAppeals);

        if (pinEl) {
                const meta = [
                        selectedAddress?.pin ? [String(selectedAddress.pin).includes(',') ? 'PINs' : 'PIN', selectedAddress.pin] : null,
                        selectedAppealStatus ? ['Appeal Status', selectedAppealStatus] : null,
                        details?.pinProrationRate ? ['PIN Proration Code', formatPercent(details.pinProrationRate)] : null,
                        details?.lastAppealYear ? ['Last Appeal', details.lastAppealYear] : null,
                        details?.municipalityName ? ['Municipality', details.municipalityName] : null,
                        details?.townshipName ? ['Township', details.townshipName] : null,
                        ['State Equalizer', `${formatEqualizer(taxContext.stateEqualizer)} (${taxContext.taxYear})`],
                        ['Local Tax Rate', formatTaxRate(taxContext.localTaxRate)],
                        details?.mailingName ? ['Mailing Name', details.mailingName] : null,
                        details?.mailingAddress ? ['Mailing Address', details.mailingAddress] : null,
                        details?.appealCalendar?.boardOfReviewAppealDates ? ['Board Review', details.appealCalendar.boardOfReviewAppealDates] : null
                ].filter(Boolean);

                if (meta.length) {
                        selectedPinForImage = String(selectedAddress?.pin || '').split(',')[0].trim();
                        pinEl.innerHTML = meta.map(([label, value]) => `
                                <div class="selected-address-meta-row">
                                        <span>${escapeHtml(label)}:</span>
                                        <strong>${escapeHtml(value)}</strong>
                                </div>
                        `).join('');
                        pinEl.style.display = 'block';
                } else {
                        pinEl.innerHTML = '';
                        pinEl.style.display = 'none';
                }
        }

        renderPropertyDetails(details);
        renderPropertyImage(selectedPinForImage);
        renderGovernmentIdImage();
        renderSupportingDocuments(selectedPinForImage);

        document.getElementById('total-appeals-count').textContent = filteredAppeals.length;

        renderAppeals(filteredAppeals, address);
}

async function renderPropertyImage(pin) {
        const preview = document.getElementById('property-image-preview');
        const dateEl = document.getElementById('property-image-date');
        if (!preview || !dateEl) return;

        preview.style.display = 'none';
        preview.removeAttribute('src');
        if (!pin) {
                dateEl.textContent = 'PIN unavailable. Image upload is disabled for this property.';
                return;
        }

        dateEl.textContent = 'Loading image...';

        try {
                const response = await dashboardAuthFetch(`/api/property-image?pin=${encodeURIComponent(pin)}`);
                if (!response.ok) throw new Error('Failed to load image');

                const data = await response.json();
                if (!data.image) {
                        dateEl.textContent = 'No image uploaded. Re-uploading saves a new copy and shows the latest upload.';
                        return;
                }

                preview.src = data.image.image_data;
                preview.style.display = 'block';
                dateEl.textContent = `Latest upload ${new Date(data.image.uploaded_at).toLocaleString()}`;
        } catch (error) {
                console.error('Error loading property image:', error);
                dateEl.textContent = 'Image could not be loaded.';
        }
}

async function renderGovernmentIdImage() {
        const preview = document.getElementById('government-id-preview');
        const dateEl = document.getElementById('government-id-date');
        if (!preview || !dateEl) return;

        preview.style.display = 'none';
        preview.removeAttribute('src');
        dateEl.textContent = 'Loading ID...';

        try {
                const response = await dashboardAuthFetch('/api/government-id-image');
                if (!response.ok) throw new Error('Failed to load government ID');

                const data = await response.json();
                if (!data.image) {
                        dateEl.textContent = 'No ID uploaded. Re-uploading saves a new copy and shows the latest upload.';
                        return;
                }

                preview.src = data.image.image_data;
                preview.style.display = 'block';
                dateEl.textContent = `Latest upload ${new Date(data.image.uploaded_at).toLocaleString()}`;
        } catch (error) {
                console.error('Error loading government ID:', error);
                dateEl.textContent = 'ID could not be loaded.';
        }
}

async function renderSupportingDocuments(pin) {
        const statusEl = document.getElementById('supporting-documents-status');
        const listEl = document.getElementById('supporting-documents-list');
        if (!statusEl || !listEl) return;

        listEl.innerHTML = '';
        updateSupportingDocumentSlots(0);

        if (!pin) {
                statusEl.textContent = 'PIN unavailable. Supporting document upload is disabled for this property.';
                return;
        }

        statusEl.textContent = 'Loading supporting documents...';

        try {
                const response = await dashboardAuthFetch(`/api/supporting-documents?pin=${encodeURIComponent(pin)}`);
                if (!response.ok) throw new Error('Failed to load supporting documents');

                const data = await response.json();
                const documents = Array.isArray(data.documents) ? data.documents : [];
                if (!documents.length) {
                        statusEl.textContent = 'No supporting documents uploaded.';
                        return;
                }

                statusEl.textContent = `${documents.length} supporting document${documents.length === 1 ? '' : 's'} uploaded.`;
                listEl.innerHTML = documents.map(doc => `
                        <li>
                                <strong>${escapeHtml(doc.file_name || 'Supporting document')}</strong>
                                <span class="text-muted">uploaded ${escapeHtml(new Date(doc.uploaded_at).toLocaleString())}</span>
                        </li>
                `).join('');
                updateSupportingDocumentSlots(documents.length);
        } catch (error) {
                console.error('Error loading supporting documents:', error);
                statusEl.textContent = 'Supporting documents could not be loaded.';
        }
}

function setupPropertyImageUpload() {
        const input = document.getElementById('property-image-input');
        if (!input || input.dataset.bound === 'true') return;
        input.dataset.bound = 'true';

        input.addEventListener('change', async () => {
                const file = input.files?.[0];
                if (!file || !selectedAddressForImage || !selectedPinForImage) return;

                try {
                        const resized = await resizeImage(file, 400, 400);
                        const response = await dashboardAuthFetch('/api/property-image', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                        address: selectedAddressForImage,
                                        pin: selectedPinForImage,
                                        imageData: resized.imageData,
                                        mimeType: resized.mimeType
                                })
                        });

                        if (!response.ok) {
                                const err = await response.json();
                                alert(`Failed to upload image: ${err.error}`);
                                return;
                        }

                        await renderPropertyImage(selectedPinForImage);
                } catch (error) {
                        console.error('Error uploading image:', error);
                        alert('The image could not be uploaded.');
                } finally {
                        input.value = '';
                }
        });
}

function setupGovernmentIdUpload() {
        const input = document.getElementById('government-id-input');
        if (!input || input.dataset.bound === 'true') return;
        input.dataset.bound = 'true';

        input.addEventListener('change', async () => {
                const file = input.files?.[0];
                if (!file) return;

                try {
                        const resized = await resizeImage(file, 900, 900);
                        const response = await dashboardAuthFetch('/api/government-id-image', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                        imageData: resized.imageData,
                                        mimeType: resized.mimeType
                                })
                        });

                        if (!response.ok) {
                                const err = await response.json();
                                alert(`Failed to upload ID: ${err.error}`);
                                return;
                        }

                        await renderGovernmentIdImage();
                } catch (error) {
                        console.error('Error uploading government ID:', error);
                        alert('The government ID image could not be uploaded.');
                } finally {
                        input.value = '';
                }
        });
}

function setupSupportingDocumentsUpload() {
        const slots = document.getElementById('supporting-documents-upload-slots');
        if (!slots || slots.dataset.bound === 'true') return;
        slots.dataset.bound = 'true';
        slots.innerHTML = Array.from({ length: MAX_SUPPORTING_DOCUMENTS }, (_, index) => {
                const number = index + 1;
                return `
                        <div class="supporting-document-slot" data-slot="${number}" ${index === 0 ? '' : 'hidden'}>
                                <label class="btn btn-secondary btn-sm upload-action-btn" for="supporting-document-input-${number}">Upload Doc ${number}<sup>1</sup></label>
                                <input type="file" id="supporting-document-input-${number}" accept="${SUPPORTING_DOCUMENT_ACCEPT}" style="display: none;">
                        </div>
                `;
        }).join('');

        slots.querySelectorAll('input[type="file"]').forEach(input => {
                input.addEventListener('change', async () => {
                        const file = input.files?.[0];
                        if (!file || !selectedAddressForImage || !selectedPinForImage) return;

                        try {
                                if (!isAllowedSupportingDocument(file)) {
                                        alert(`${file.name} is not an accepted document type. Please upload PDF, DOC, DOCX, JPG, PNG, or WEBP files.`);
                                        return;
                                }

                                if (file.size > 4 * 1024 * 1024) {
                                        alert(`${file.name} is too large. Please upload files under 4 MB.`);
                                        return;
                                }

                                const dataUrl = await readFileAsDataUrl(file);
                                const response = await dashboardAuthFetch('/api/supporting-documents', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                                address: selectedAddressForImage,
                                                pin: selectedPinForImage,
                                                fileName: file.name,
                                                fileData: dataUrl,
                                                mimeType: file.type || mimeTypeFromFileName(file.name)
                                        })
                                });

                                if (!response.ok) {
                                        const err = await response.json();
                                        alert(`Failed to upload ${file.name}: ${err.error}`);
                                        return;
                                }

                                await renderSupportingDocuments(selectedPinForImage);
                        } catch (error) {
                                console.error('Error uploading supporting documents:', error);
                                alert('The supporting document could not be uploaded.');
                        } finally {
                                input.value = '';
                        }
                });
        });
}

function updateSupportingDocumentSlots(uploadedCount) {
        const slots = document.getElementById('supporting-documents-upload-slots');
        if (!slots) return;

        const nextOpenSlot = Math.min(Number(uploadedCount || 0) + 1, MAX_SUPPORTING_DOCUMENTS);
        slots.querySelectorAll('.supporting-document-slot').forEach(slot => {
                const slotNumber = Number(slot.dataset.slot);
                slot.hidden = slotNumber > nextOpenSlot;
        });

        const reachedLimit = Number(uploadedCount || 0) >= MAX_SUPPORTING_DOCUMENTS;
        if (reachedLimit) {
                slots.querySelectorAll('.supporting-document-slot').forEach(slot => {
                        slot.hidden = Number(slot.dataset.slot) > MAX_SUPPORTING_DOCUMENTS;
                });
                slots.querySelectorAll('label').forEach(label => {
                        label.classList.add('disabled');
                        label.setAttribute('aria-disabled', 'true');
                });
                slots.querySelectorAll('input').forEach(input => {
                        input.disabled = true;
                });
        } else {
                slots.querySelectorAll('label').forEach(label => {
                        label.classList.remove('disabled');
                        label.removeAttribute('aria-disabled');
                });
                slots.querySelectorAll('input').forEach(input => {
                        input.disabled = false;
                });
        }
}

function isAllowedSupportingDocument(file) {
        const mimeType = (file.type || '').toLowerCase();
        const name = (file.name || '').toLowerCase();
        return ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(mimeType)
                || ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)
                || name.endsWith('.pdf')
                || name.endsWith('.doc')
                || name.endsWith('.docx')
                || name.endsWith('.jpg')
                || name.endsWith('.jpeg')
                || name.endsWith('.png')
                || name.endsWith('.webp');
}

function mimeTypeFromFileName(fileName) {
        const name = String(fileName || '').toLowerCase();
        if (name.endsWith('.pdf')) return 'application/pdf';
        if (name.endsWith('.doc')) return 'application/msword';
        if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
        if (name.endsWith('.png')) return 'image/png';
        if (name.endsWith('.webp')) return 'image/webp';
        return 'application/octet-stream';
}

function resizeImage(file, maxWidth, maxHeight) {
        return new Promise((resolve, reject) => {
                const image = new Image();
                const reader = new FileReader();

                reader.onload = () => {
                        image.onload = () => {
                                const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
                                const width = Math.max(1, Math.round(image.width * scale));
                                const height = Math.max(1, Math.round(image.height * scale));
                                const canvas = document.createElement('canvas');
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(image, 0, 0, width, height);

                                resolve({
                                        imageData: canvas.toDataURL('image/jpeg', 0.82),
                                        mimeType: 'image/jpeg'
                                });
                        };
                        image.onerror = reject;
                        image.src = reader.result;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
        });
}

function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
        });
}

function renderPropertyDetails(details) {
        const container = document.getElementById('selected-property-details');
        if (!container) return;
        const taxContext = taxContextForDisplay(details);

        const fields = [
                ['Assessed Value', formatCurrency(displayAssessedValue(details?.taxableValue))],
                ['Equalized Assessed Value', formatCurrency(taxContext.equalizedAssessedValue)],
                ['Imported Exemptions', formatExemptions(taxContext.exemptions)],
                ['Bedrooms', formatNumber(details?.bedroomCount)],
                ['Full Baths', formatFullBaths(details?.bathroomCount)],
                ['Half Baths', formatHalfBaths(details?.bathroomCount)],
                ['Year Built', formatWholeNumber(details?.yearBuilt)],
                ['Walkability Score', formatNumber(details?.cmapWalkabilityTotalScore)],
                ['Property Class', details?.propertyClass],
                ['Single vs Multi-Family', details?.singleVsMultiFamily],
                ['Masonry Type', details?.masonryType],
                ['Repair', details?.repairCondition],
                ['Basement', details?.finishedBasement],
                ['Garage', details?.garageSize],
                ['Certified Land', formatCurrency(details?.certifiedLand)],
                ['Certified Property', formatCurrency(details?.certifiedBuilding)]
        ].filter(field => field && field[1] !== null && field[1] !== undefined && field[1] !== '');

        if (!fields.length) {
                container.style.display = 'none';
                container.innerHTML = '';
                return;
        }

        container.innerHTML = fields.map(([label, value]) => `
                <div class="property-detail-item">
                        <span>${escapeHtml(label)}</span>
                        <strong>${escapeHtml(value)}</strong>
                </div>
        `).join('');
        container.style.display = 'grid';
}

function renderAppeals(appeals, address) {
        const historyContainer = document.getElementById('appeal-history-list');
        if (!historyContainer) return;
        const selectedProperty = userAddresses.find(item => item.address === address) || null;
        window.currentAppealPropertyContext = selectedProperty;

        if (appeals.length === 0) {
                historyContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem 0; color: var(--text-muted);">
                <p>No appeals found for this property.</p>
                <p class="text-sm text-muted">We are not accepting appeal submissions yet. Join the waitlist and we will follow up when the service is ready.</p>
                <button class="btn btn-primary appeal-again-btn" data-address="${escapeHtml(address)}" style="margin-top: 1rem;">Start Appeal</button>
                ${uploadLegalFootnote()}
            </div>
        `;
        } else {
                let html = '<ul class="history-list">';
                appeals.forEach((data) => {
                        const payDate = data.paymentDate ? new Date(data.paymentDate).toLocaleDateString() : 'N/A';
                        const appDate = data.appealDate ? new Date(data.appealDate).toLocaleDateString() : 'N/A';

                        // Use explicit appealStatus if available, otherwise fallback
                        const displayStatus = String(data.paymentStatus || '').toLowerCase() === 'refunded'
                                ? 'Refunded'
                                : data.appealStatus || capitalize(data.status || 'pending');
                        // For class styling let's use a normalized version
                        const statusClass = getStatusClass(displayStatus.toLowerCase());

                        html += `
                <li class="history-item" style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div class="history-info">
                            <span class="history-date text-sm text-muted">Date of Successful Payment: ${payDate}</span>
                            <div style="margin-top: 0.25rem; font-size: 0.875rem;" class="text-muted">Date of Appeal: ${appDate}</div>
                            <div style="margin-top: 0.25rem; font-size: 0.875rem;" class="text-muted">Payment Status: ${escapeHtml(formatPaymentStatus(data.paymentStatus))}</div>
                            <div style="margin-top: 0.5rem; font-weight: 500;">Amount: $${data.amount ? (data.amount / 100).toFixed(2) : '0.00'}</div>
                        </div>
                        <div class="history-status" style="text-align: right;">
                             <span class="status-badge ${statusClass}">${escapeHtml(displayStatus)}</span>
                        </div>
                    </div>
                </li>
            `;
                });
                html += '</ul>';
                html += `<button class="btn btn-secondary appeal-again-btn btn-full" data-address="${escapeHtml(address)}" style="margin-top: 1rem;">Start Another Appeal</button>`;
                html += uploadLegalFootnote();
                historyContainer.innerHTML = html;
        }

        // Add Event Listeners for appeal buttons
        historyContainer.querySelectorAll('.appeal-again-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                        const addr = e.currentTarget.dataset.address;
                        const { openAppealModal } = await import('./appeal.js?v=20260524-checkout-address');
                        openAppealModal(addr, selectedProperty);
                });
        });
}

function uploadLegalFootnote() {
        return `
                <p class="upload-legal-copy upload-legal-copy-appeal">
                        <sup>1</sup> By uploading images or documents, you represent that you have the right to provide them and authorize Cook County Tax Compare, its service providers, and any attorney or representative assisting with your appeal to store, review, reproduce, transmit, and submit the materials as reasonably necessary to evaluate, prepare, file, support, or respond to your property tax appeal. Uploaded materials remain associated with your account and appeal records. We do not use uploaded materials for unrelated marketing or non-appeal purposes.
                </p>
        `;
}

function setupAddAddressForm() {
        const form = document.getElementById('add-address-form');
        if (!form) return;
        if (form.dataset.bound === 'true') return;
        form.dataset.bound = 'true';

        form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const input = document.getElementById('new-property-address');
                const address = selectedAddressSuggestion;
                const propertyKey = selectedPropertyKeySuggestion;
                const typedAddress = input.value.trim();
                if (!address && typedAddress) {
                        await updateAddressSuggestions(typedAddress, true);
                        input.focus();
                        return;
                }

                if (!address || !propertyKey) return;

                const btn = document.getElementById('add-address-btn');
                const originalText = btn.textContent;
                btn.textContent = 'Adding...';
                btn.disabled = true;

                try {
                        const response = await dashboardAuthFetch('/api/addresses', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ address, propertyKey })
                        });

                        if (response.ok) {
                                input.value = '';
                                selectedAddressSuggestion = '';
                                selectedPropertyKeySuggestion = '';
                                hideAddressSuggestions('property-address-suggestions');
                                // Refresh data
                                await fetchAddresses();
                                if (dashboardUser) saveDashboardCache(dashboardUser.uid);
                                renderAccountSummary(dashboardUser || auth.currentUser);
                                renderAddressList();
                        } else {
                                const err = await response.json();
                                alert(`Failed to add address: ${err.error}`);
                        }
                } catch (error) {
                        console.error("Error adding address:", error);
                        alert('An error occurred while adding the address.');
                } finally {
                        btn.textContent = originalText;
                        btn.disabled = false;
                }
        });

        const input = document.getElementById('new-property-address');
        input?.addEventListener('input', () => {
                selectedAddressSuggestion = '';
                selectedPropertyKeySuggestion = '';
                currentSuggestions = [];
                window.clearTimeout(lookupTimer);
                lookupTimer = window.setTimeout(() => {
                        updateAddressSuggestions(input.value);
                }, 250);
        });

        input?.addEventListener('focus', () => {
                if (input.value.trim().length >= 3) {
                        updateAddressSuggestions(input.value);
                }
        });

        document.addEventListener('click', (event) => {
                if (!event.target.closest('#add-address-form')) {
                        hideAddressSuggestions('property-address-suggestions');
                }
        });
}

async function updateAddressSuggestions(query, forceVisible = false) {
        const suggestionsPanel = document.getElementById('property-address-suggestions');
        if (!suggestionsPanel) return;

        if (!query || query.trim().length < 3) {
                hideAddressSuggestions('property-address-suggestions');
                return;
        }

        suggestionsPanel.innerHTML = '<div class="address-suggestion-helper">Searching Cook County addresses...</div>';
        suggestionsPanel.classList.add('is-visible');

        try {
                const response = await dashboardAuthFetch(`/api/address-lookup?q=${encodeURIComponent(query)}&limit=5`);
                if (!response.ok) {
                        const error = await response.json().catch(() => ({}));
                        renderAddressSuggestionMessage(
                                'property-address-suggestions',
                                error.error || 'Could not load address suggestions.'
                        );
                        return;
                }

                const data = await response.json();
                currentSuggestions = data.suggestions || [];
                renderAddressSuggestions('property-address-suggestions', currentSuggestions, (item) => {
                        const input = document.getElementById('new-property-address');
                        if (input) {
                                input.value = item.address;
                                input.focus();
                        }
                        selectedAddressSuggestion = item.address;
                        selectedPropertyKeySuggestion = item.propertyKey || '';
                }, forceVisible ? 'Select the closest matching address before adding it.' : '');
        } catch (error) {
                console.error('Address lookup failed:', error);
                renderAddressSuggestionMessage('property-address-suggestions', 'Could not load address suggestions.');
        }
}

function renderAddressSuggestions(containerId, suggestions, onSelect, helperText = '') {
        const panel = document.getElementById(containerId);
        if (!panel) return;

        if (!suggestions.length) {
                renderAddressSuggestionMessage(
                        containerId,
                        'No close matches yet. Try the full street number, street name, city, or ZIP.'
                );
                return;
        }

        panel.innerHTML = `
                ${helperText ? `<div class="address-suggestion-helper">${escapeHtml(helperText)}</div>` : ''}
                ${suggestions.slice(0, 5).map((item, index) => `
                <button type="button" class="address-suggestion" role="option" data-index="${index}">
                        ${escapeHtml(item.address)}
                        <span>${escapeHtml([
                                item.pin ? `PIN ${item.pin}` : 'Cook County property record',
                                item.mailingName ? item.mailingName : '',
                                item.pinProrationRate ? `Proration ${formatPercent(item.pinProrationRate)}` : ''
                        ].filter(Boolean).join(' | '))}</span>
                </button>
        `).join('')}`;
        panel.classList.add('is-visible');

        panel.querySelectorAll('.address-suggestion').forEach(button => {
                button.addEventListener('click', () => {
                        onSelect(suggestions[Number(button.dataset.index)]);
                        hideAddressSuggestions(containerId);
                });
        });
}

function renderAddressSuggestionMessage(containerId, message) {
        const panel = document.getElementById(containerId);
        if (!panel) return;
        panel.innerHTML = `<div class="address-suggestion-helper">${escapeHtml(message)}</div>`;
        panel.classList.add('is-visible');
}

function hideAddressSuggestions(containerId) {
        const panel = document.getElementById(containerId);
        if (!panel) return;
        panel.innerHTML = '';
        panel.classList.remove('is-visible');
}

function getStatusClass(status) {
        switch (status) {
                case 'completed': return 'status-success';
                case 'success': return 'status-success';
                case 'finished': return 'status-success';
                case 'pending': return 'status-pending';
                case 'failed': return 'status-error';
                case 'refunded': return 'status-error';
                case 'denied': return 'status-error';
                default: return 'status-neutral';
        }
}

function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatCurrency(value) {
        if (value === null || value === undefined || value === '') return '';
        return Number(value).toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0
        });
}

function formatPaymentStatus(status) {
        const normalized = String(status || '').toLowerCase();
        if (normalized === 'paid') return 'Paid';
        if (normalized === 'refunded') return 'Refunded';
        if (normalized === 'expired') return 'Expired';
        if (normalized === 'failed') return 'Failed';
        if (!normalized) return 'N/A';
        return capitalize(normalized);
}

function displayAssessedValue(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number * ASSESSED_VALUE_DISPLAY_MULTIPLIER : null;
}

function taxContextForDisplay(details) {
        const taxableValue = Number(details?.taxableValue);
        const fallbackEav = Number.isFinite(taxableValue)
                ? Math.round(taxableValue * CURRENT_STATE_EQUALIZER)
                : null;

        return {
                taxYear: details?.taxContext?.taxYear || CURRENT_TAX_YEAR,
                stateEqualizer: Number(details?.taxContext?.stateEqualizer) || CURRENT_STATE_EQUALIZER,
                equalizedAssessedValue: details?.taxContext?.equalizedAssessedValue ?? fallbackEav,
                localTaxRate: details?.taxContext?.localTaxRate ?? null,
                exemptions: Array.isArray(details?.taxContext?.exemptions) ? details.taxContext.exemptions : []
        };
}

function formatNumber(value, suffix = '') {
        if (value === null || value === undefined || value === '') return '';
        return `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 })}${suffix}`;
}

function bathParts(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) {
                return { fullBaths: null, halfBaths: null };
        }

        const fullBaths = Math.trunc(number);
        const halfBaths = Math.round((number - fullBaths) * 2);
        return {
                fullBaths: fullBaths + Math.trunc(halfBaths / 2),
                halfBaths: halfBaths % 2
        };
}

function formatFullBaths(value) {
        const { fullBaths } = bathParts(value);
        return fullBaths === null ? '' : formatNumber(fullBaths);
}

function formatHalfBaths(value) {
        const { halfBaths } = bathParts(value);
        return halfBaths === null ? '' : formatNumber(halfBaths);
}

function formatWholeNumber(value) {
        if (value === null || value === undefined || value === '') return '';
        const number = Number(value);
        if (!Number.isFinite(number)) return '';
        return String(Math.trunc(number));
}

function formatPercent(value) {
        if (value === null || value === undefined || value === '') return '';
        return `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 3 })}`;
}

function formatTaxRate(value) {
        if (value === null || value === undefined || value === '') return 'Not imported';
        const number = Number(value);
        if (!Number.isFinite(number)) return 'Not imported';
        return `${number.toLocaleString('en-US', { maximumFractionDigits: 3 })}%`;
}

function formatEqualizer(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return '';
        return number.toFixed(4);
}

function formatExemptions(exemptions) {
        if (!Array.isArray(exemptions) || !exemptions.length) return 'None imported';
        return exemptions.map(item => item.type).filter(Boolean).join(', ') || 'Imported';
}

function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, char => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
        })[char]);
}
