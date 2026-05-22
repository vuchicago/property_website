import { auth, authFetch } from './auth.js';

let userAddresses = [];
let allAppeals = [];
let lookupTimer = null;
let selectedAddressSuggestion = '';
let selectedPropertyKeySuggestion = '';
let currentSuggestions = [];
let selectedAddressForImage = '';
let selectedPinForImage = '';

export async function loadAppealHistory() {
        const user = auth.currentUser;
        if (!user) return;

        // Load both addresses and appeals
        await Promise.all([
                fetchAddresses(),
                fetchAppeals()
        ]);

        renderAccountSummary(user);
        renderAddressList();
        setupAddAddressForm();
        setupPropertyImageUpload();
        setupGovernmentIdUpload();
}

async function fetchAddresses() {
        try {
                const response = await authFetch('/api/addresses');
                if (!response.ok) throw new Error('Failed to fetch addresses');
                userAddresses = await response.json();
        } catch (error) {
                console.error("Error fetching addresses:", error);
        }
}

async function fetchAppeals() {
        try {
                const response = await authFetch('/api/history');
                if (!response.ok) throw new Error('Failed to fetch appeals');
                allAppeals = await response.json();
        } catch (error) {
                console.error("Error fetching appeals:", error);
        }
}

function renderAccountSummary(user) {
        const emailEl = document.getElementById('account-email');
        const propertyCountEl = document.getElementById('property-count');
        const appealCountEl = document.getElementById('appeal-count');
        const pendingCountEl = document.getElementById('pending-appeal-count');

        if (emailEl) emailEl.textContent = user.email || 'Signed in';
        if (propertyCountEl) propertyCountEl.textContent = userAddresses.length;
        if (appealCountEl) {
                appealCountEl.textContent = allAppeals.filter(appeal => {
                        const status = (appeal.appealStatus || appeal.status || '').toLowerCase();
                        return status && status !== 'pending';
                }).length;
        }
        if (pendingCountEl) {
                pendingCountEl.textContent = allAppeals.filter(appeal => (appeal.appealStatus || appeal.status || '').toLowerCase() === 'pending').length;
        }
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
                const appealCount = allAppeals.filter(a => a.propertyAddress === addrObj.address).length;
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

async function deleteAddress(address, propertyKey) {
        const confirmed = window.confirm(`Delete ${address} from My Properties?`);
        if (!confirmed) return;

        try {
                const response = await authFetch('/api/addresses', {
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
                renderAccountSummary(auth.currentUser);
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
        const pinEl = document.getElementById('selected-address-pin');

        if (pinEl) {
                const meta = [
                        selectedAddress?.pin ? [String(selectedAddress.pin).includes(',') ? 'PINs' : 'PIN', selectedAddress.pin] : null,
                        details?.pinProrationRate ? ['PIN Proration Code', formatPercent(details.pinProrationRate)] : null,
                        details?.lastAppealYear ? ['Last Appeal', details.lastAppealYear] : null,
                        details?.mailingName ? ['Mailing Name', details.mailingName] : null,
                        details?.mailingAddress ? ['Mailing Address', details.mailingAddress] : null
                ].filter(Boolean);

                if (meta.length) {
                        selectedPinForImage = String(selectedAddress?.pin || '').split(',')[0].trim();
                        pinEl.innerHTML = meta.map(([label, value]) => `
                                <div class="selected-address-meta-row">
                                        <span>${escapeHtml(label)}</span>
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
        renderPropertyImage(selectedAddress?.pin);
        renderGovernmentIdImage();

        const filteredAppeals = allAppeals.filter(a => a.propertyAddress === address);
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
                const response = await authFetch(`/api/property-image?pin=${encodeURIComponent(pin)}`);
                if (!response.ok) throw new Error('Failed to load image');

                const data = await response.json();
                if (!data.image) {
                        dateEl.textContent = 'No image uploaded.';
                        return;
                }

                preview.src = data.image.image_data;
                preview.style.display = 'block';
                dateEl.textContent = `Uploaded ${new Date(data.image.uploaded_at).toLocaleString()}`;
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
                const response = await authFetch('/api/government-id-image');
                if (!response.ok) throw new Error('Failed to load government ID');

                const data = await response.json();
                if (!data.image) {
                        dateEl.textContent = 'No ID uploaded.';
                        return;
                }

                preview.src = data.image.image_data;
                preview.style.display = 'block';
                dateEl.textContent = `Uploaded ${new Date(data.image.uploaded_at).toLocaleString()}`;
        } catch (error) {
                console.error('Error loading government ID:', error);
                dateEl.textContent = 'ID could not be loaded.';
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
                        const response = await authFetch('/api/property-image', {
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
                        const response = await authFetch('/api/government-id-image', {
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

function renderPropertyDetails(details) {
        const container = document.getElementById('selected-property-details');
        if (!container) return;

        const fields = [
                ['Taxable Value', formatCurrency(details?.taxableValue)],
                ['Bedrooms', formatNumber(details?.bedroomCount)],
                ['Bathrooms', formatNumber(details?.bathroomCount)],
                ['Year Built', formatWholeNumber(details?.yearBuilt)],
                ['Property Class', details?.propertyClass],
                ['Single vs Multi-Family', details?.singleVsMultiFamily],
                ['Municipality', details?.municipalityName],
                ['Walkability Score', formatNumber(details?.cmapWalkabilityTotalScore)],
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

        if (appeals.length === 0) {
                historyContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem 0; color: var(--text-muted);">
                <p>No appeals found for this property.</p>
                <button class="btn btn-primary appeal-again-btn" data-address="${escapeHtml(address)}" style="margin-top: 1rem;">Start Appeal</button>
            </div>
        `;
        } else {
                let html = '<ul class="history-list">';
                appeals.forEach((data) => {
                        const payDate = data.paymentDate ? new Date(data.paymentDate).toLocaleDateString() : 'N/A';
                        const appDate = data.appealDate ? new Date(data.appealDate).toLocaleDateString() : 'N/A';

                        // Use explicit appealStatus if available, otherwise fallback
                        const displayStatus = data.appealStatus || capitalize(data.status || 'pending');
                        // For class styling let's use a normalized version
                        const statusClass = getStatusClass(displayStatus.toLowerCase());

                        html += `
                <li class="history-item" style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div class="history-info">
                            <span class="history-date text-sm text-muted">Paid on ${payDate}</span>
                            <div style="margin-top: 0.25rem; font-size: 0.875rem;" class="text-muted">Appeal Date: ${appDate}</div>
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
                html += `<button class="btn btn-secondary appeal-again-btn btn-full" data-address="${escapeHtml(address)}" style="margin-top: 1rem;">Appeal Again</button>`;
                historyContainer.innerHTML = html;
        }

        // Add Event Listeners for appeal buttons
        historyContainer.querySelectorAll('.appeal-again-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                        const addr = e.currentTarget.dataset.address;
                        const { openAppealModal } = await import('./appeal.js?v=20260521-address-suggestions');
                        openAppealModal(addr);
                });
        });
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
                        const response = await authFetch('/api/addresses', {
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
                                renderAccountSummary(auth.currentUser);
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
                const response = await authFetch(`/api/address-lookup?q=${encodeURIComponent(query)}&limit=5`);
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

function formatNumber(value, suffix = '') {
        if (value === null || value === undefined || value === '') return '';
        return `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 })}${suffix}`;
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

function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, char => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
        })[char]);
}
