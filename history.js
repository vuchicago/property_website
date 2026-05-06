import { auth, authFetch } from './auth.js';

let userAddresses = [];
let allAppeals = [];
let lookupTimer = null;
let selectedAddressSuggestion = '';

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
        if (appealCountEl) appealCountEl.textContent = allAppeals.length;
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

                html += `
            <li class="address-item" style="padding: 1rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s;" data-address="${safeAddress}">
                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem;">
                        <div>
                                <div style="font-weight: 500; margin-bottom: 0.25rem;">${safeAddress}</div>
                                <div class="text-xs text-muted">${appealCount} appeal(s)</div>
                        </div>
                        ${canDelete ? `<button type="button" class="btn btn-secondary btn-sm delete-address-btn" data-address="${safeAddress}" aria-label="Delete ${safeAddress}">Delete</button>` : ''}
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

                        const address = e.currentTarget.dataset.address;
                        selectAddress(address);
                });
        });

        listContainer.querySelectorAll('.delete-address-btn').forEach(button => {
                button.addEventListener('click', async (event) => {
                        event.stopPropagation();
                        const address = event.currentTarget.dataset.address;
                        if (!address) return;

                        await deleteAddress(address);
                });
        });
}

async function deleteAddress(address) {
        const confirmed = window.confirm(`Delete ${address} from My Properties?`);
        if (!confirmed) return;

        try {
                const response = await authFetch('/api/addresses', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ address })
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

function selectAddress(address) {
        document.getElementById('no-address-selected-msg').style.display = 'none';
        const detailsPanel = document.getElementById('appeal-details-container');
        detailsPanel.style.display = 'block';

        document.getElementById('selected-address-title').textContent = address;

        const filteredAppeals = allAppeals.filter(a => a.propertyAddress === address);
        document.getElementById('total-appeals-count').textContent = filteredAppeals.length;

        renderAppeals(filteredAppeals, address);
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
                        const { openAppealModal } = await import('./appeal.js?v=20260506-address-suggestions');
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
                const address = selectedAddressSuggestion || input.value.trim();
                if (!address) return;

                const btn = document.getElementById('add-address-btn');
                const originalText = btn.textContent;
                btn.textContent = 'Adding...';
                btn.disabled = true;

                try {
                        const response = await authFetch('/api/addresses', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ address })
                        });

                        if (response.ok) {
                                input.value = '';
                                selectedAddressSuggestion = '';
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
                window.clearTimeout(lookupTimer);
                lookupTimer = window.setTimeout(() => {
                        updateAddressSuggestions(input.value);
                }, 250);
        });

        document.addEventListener('click', (event) => {
                if (!event.target.closest('#add-address-form')) {
                        hideAddressSuggestions('property-address-suggestions');
                }
        });
}

async function updateAddressSuggestions(query) {
        const suggestionsPanel = document.getElementById('property-address-suggestions');
        if (!suggestionsPanel) return;

        if (!query || query.trim().length < 3) {
                hideAddressSuggestions('property-address-suggestions');
                return;
        }

        try {
                const response = await authFetch(`/api/address-lookup?q=${encodeURIComponent(query)}&limit=5`);
                if (!response.ok) return;

                const data = await response.json();
                renderAddressSuggestions('property-address-suggestions', data.suggestions || [], (address) => {
                        const input = document.getElementById('new-property-address');
                        if (input) {
                                input.value = address;
                                input.focus();
                        }
                        selectedAddressSuggestion = address;
                });
        } catch (error) {
                console.error('Address lookup failed:', error);
        }
}

function renderAddressSuggestions(containerId, suggestions, onSelect) {
        const panel = document.getElementById(containerId);
        if (!panel) return;

        if (!suggestions.length) {
                hideAddressSuggestions(containerId);
                return;
        }

        panel.innerHTML = suggestions.slice(0, 5).map(item => `
                <button type="button" class="address-suggestion" role="option" data-address="${escapeHtml(item.address)}">
                        ${escapeHtml(item.address)}
                        <span>PIN ${escapeHtml(item.pin || 'not available')}</span>
                </button>
        `).join('');
        panel.classList.add('is-visible');

        panel.querySelectorAll('.address-suggestion').forEach(button => {
                button.addEventListener('click', () => {
                        onSelect(button.dataset.address);
                        hideAddressSuggestions(containerId);
                });
        });
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

function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, char => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
        })[char]);
}
