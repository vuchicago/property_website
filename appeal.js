
// Appeal Modal Functionality

document.addEventListener('DOMContentLoaded', function () {
        initAppealModal();
});

let selectedAppealAddressSuggestion = '';
let selectedAppealPropertyContext = null;
let appealConfigPromise = null;

function initAppealModal() {
        // We will dynamically create the modal HTML to keep index.html clean
        createAppealModalHTML();

        const modal = document.getElementById('appeal-modal');
        const closeBtn = document.getElementById('close-appeal-modal');
        const form = document.getElementById('appeal-form');

        // Close modal
        closeBtn?.addEventListener('click', () => {
                closeAppealModal();
        });

        // Close on click outside
        window.addEventListener('click', (e) => {
                if (e.target === modal) {
                        closeAppealModal();
                }
        });

        form?.addEventListener('submit', (e) => {
                e.preventDefault();
                handleAppealSubmit();
        });

        const addressInput = document.getElementById('appeal-address');
        addressInput?.addEventListener('input', () => {
                selectedAppealAddressSuggestion = '';
                window.clearTimeout(Number(addressInput.dataset.lookupTimer || 0));
                const timer = window.setTimeout(() => {
                        updateAppealAddressSuggestions(addressInput.value);
                }, 250);
                addressInput.dataset.lookupTimer = String(timer);
        });

        document.addEventListener('click', (event) => {
                if (!event.target.closest('#appeal-form')) {
                        hideAddressSuggestions('appeal-address-suggestions');
                }
        });
}

function createAppealModalHTML() {
        if (document.getElementById('appeal-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'appeal-modal';
        modal.className = 'modal';
        modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal" id="close-appeal-modal">&times;</span>
            <div class="modal-header">
                <h2>Join the Appeal Waitlist</h2>
                <p id="appeal-modal-subtitle">We are not ready to file appeals yet. Join the waitlist and we will follow up when service is available.</p>
            </div>
            <form id="appeal-form">
                <div class="input-group">
                    <label for="appeal-address">Property Address</label>
                    <div class="address-search-wrap">
                        <input type="text" id="appeal-address" autocomplete="off" aria-autocomplete="list" aria-controls="appeal-address-suggestions" placeholder="e.g. 123 Main St, Chicago, IL 60601" required>
                        <div id="appeal-address-suggestions" class="address-suggestions" role="listbox"></div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="submit" class="btn btn-primary btn-full" id="pay-appeal-btn">
                        Join the Waitlist
                    </button>
                    <p class="secure-note">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                            <path d="M12 8V12L14.5 14.5M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"></path>
                        </svg>
                        No payment today. We will use your saved account and property information for the waitlist request.
                    </p>
                </div>
            </form>
        </div>
    `;
        document.body.appendChild(modal);
}

export function openAppealModal(propertyAddress = '', propertyContext = null) {
        const modal = document.getElementById('appeal-modal');
        selectedAppealPropertyContext = propertyContext;
        if (modal) {
                setAppealAddress(propertyAddress);
                modal.classList.add('show');
                refreshAppealModeText(propertyAddress);
                const addressInput = document.getElementById('appeal-address');
                const waitlistBtn = document.getElementById('pay-appeal-btn');
                if (propertyAddress && waitlistBtn) {
                        waitlistBtn.focus();
                } else if (addressInput) {
                        addressInput.focus();
                }
        } else {
                // Fallback if init didn't run or was delayed
                createAppealModalHTML();
                initAppealModal();
                setTimeout(() => {
                        setAppealAddress(propertyAddress);
                        refreshAppealModeText(propertyAddress);
                        document.getElementById('appeal-modal').classList.add('show');
                }, 10);
        }
}

function setAppealAddress(propertyAddress = '') {
        const addressInput = document.getElementById('appeal-address');
        const subtitle = document.getElementById('appeal-modal-subtitle');
        const note = document.querySelector('#appeal-form .secure-note');
        const waitlistBtn = document.getElementById('pay-appeal-btn');

        if (!addressInput) {
                return;
        }

        addressInput.value = propertyAddress;
        addressInput.readOnly = Boolean(propertyAddress);
        selectedAppealAddressSuggestion = propertyAddress;
        hideAddressSuggestions('appeal-address-suggestions');

        if (subtitle) {
                subtitle.textContent = propertyAddress
                        ? 'This waitlist request will use the property already saved in your account.'
                        : 'Enter your property address to join the appeal waitlist.';
        }

        if (note) {
                note.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                            <path d="M12 8V12L14.5 14.5M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"></path>
                        </svg>
                        No payment today. We will use your saved account and property information for the waitlist request.
                `;
        }

        if (waitlistBtn) {
                waitlistBtn.innerHTML = 'Join the Waitlist';
                waitlistBtn.disabled = false;
        }
}

async function refreshAppealModeText(propertyAddress = '') {
        const config = await getAppealConfig();
        const title = document.querySelector('#appeal-modal .modal-header h2');
        const subtitle = document.getElementById('appeal-modal-subtitle');
        const note = document.querySelector('#appeal-form .secure-note');
        const button = document.getElementById('pay-appeal-btn');

        if (config.deploymentReady) {
                if (title) title.textContent = 'Appeal Your Property Tax';
                if (subtitle) {
                        subtitle.textContent = propertyAddress
                                ? 'This appeal will use the property already saved in your account.'
                                : "Enter your property address to start the appeal process. We'll handle the rest.";
                }
                if (button) {
                        button.innerHTML = `Pay ${formatPaymentAmount(config.appealHelpAmountCents)} & Submit Appeal`;
                        button.disabled = false;
                }
                if (note) {
                        note.innerHTML = `
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                                Secure payment via Stripe
                        `;
                }
                return;
        }

        if (title) title.textContent = 'Join the Appeal Waitlist';
        if (subtitle) {
                subtitle.textContent = propertyAddress
                        ? 'This waitlist request will use the property already saved in your account.'
                        : 'Enter your property address to join the appeal waitlist.';
        }
        if (button) {
                button.innerHTML = 'Join the Waitlist';
                button.disabled = false;
        }
        if (note) {
                note.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                            <path d="M12 8V12L14.5 14.5M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"></path>
                        </svg>
                        No payment today. We will use your saved account and property information for the waitlist request.
                `;
        }
}

function closeAppealModal() {
        const modal = document.getElementById('appeal-modal');
        if (modal) {
                modal.classList.remove('show');
        }
}

async function handleAppealSubmit() {
        const config = await getAppealConfig();
        if (config.deploymentReady) {
                return handleAppealPayment(config);
        }

        return handleAppealWaitlist();
}

async function getSelectedAppealAddress() {
        const addressInput = document.getElementById('appeal-address');
        const address = selectedAppealAddressSuggestion;
        const typedAddress = addressInput?.value.trim() || '';
        if (!address && typedAddress) {
                await updateAppealAddressSuggestions(typedAddress, true);
                addressInput?.focus();
                return '';
        }

        if (!address) {
                alert("Please enter your property address.");
                return '';
        }

        return address;
}

async function getCurrentAppealUser() {
        const { auth, authFetch } = await import('./auth-client.js?v=20260524-auth-gate');
        const user = auth.currentUser;

        if (!user) {
                alert("Please log in to continue.");
                window.location.href = 'login.html';
                return null;
        }

        return { user, authFetch };
}

async function handleAppealWaitlist() {
        const address = await getSelectedAppealAddress();
        if (!address) return;

        const authContext = await getCurrentAppealUser();
        if (!authContext) return;

        const { user, authFetch } = authContext;
        const btn = document.getElementById('pay-appeal-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Joining waitlist...';
        btn.disabled = true;

        try {
                const profile = waitlistProfileFromProperty(user, selectedAppealPropertyContext, address);
                const response = await authFetch('/api/contact', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                                inquiryType: 'property-tax-waitlist',
                                name: profile.name,
                                email: profile.email,
                                phone: profile.phone,
                                propertyAddress: address,
                                message: profile.message
                        })
                });

                if (!response.ok) {
                        const text = await response.text();
                        console.error("API Error Response:", text);

                        let errorMessage = text || response.statusText;
                        try {
                                errorMessage = JSON.parse(text).error || errorMessage;
                        } catch (e) {
                                // Keep raw text for non-JSON responses.
                        }
                        throw new Error(errorMessage);
                }

                btn.innerHTML = 'Joined Waitlist';
                const note = document.querySelector('#appeal-form .secure-note');
                if (note) {
                        note.textContent = "You're on the waitlist. We will follow up when the appeal service is ready.";
                }
                alert("You're on the waitlist. We will follow up when the appeal service is ready.");
                closeAppealModal();

        } catch (error) {
                console.error("Waitlist request failed:", error);
                alert("Could not join waitlist: " + error.message);
                btn.innerHTML = originalText;
                btn.disabled = false;
        }
}

async function handleAppealPayment(config = {}) {
        const address = await getSelectedAppealAddress();
        if (!address) return;

        const authContext = await getCurrentAppealUser();
        if (!authContext) return;

        const { authFetch } = authContext;
        const btn = document.getElementById('pay-appeal-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Processing...';
        btn.disabled = true;

        try {
                const response = await authFetch('/api/create-checkout-session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ propertyAddress: address })
                });

                if (!response.ok) {
                        const text = await response.text();
                        let errorMessage = text || response.statusText;
                        try {
                                errorMessage = JSON.parse(text).error || errorMessage;
                        } catch (e) {
                                // Keep raw text for non-JSON responses.
                        }
                        throw new Error(errorMessage);
                }

                const data = await response.json();
                if (data.url) {
                        window.location.href = data.url;
                        return;
                }

                throw new Error('No checkout URL returned');
        } catch (error) {
                console.error('Payment initiation failed:', error);
                alert('Failed to start payment: ' + error.message);
                btn.innerHTML = originalText || `Pay ${formatPaymentAmount(config.appealHelpAmountCents)} & Submit Appeal`;
                btn.disabled = false;
        }
}

async function getAppealConfig() {
        if (!appealConfigPromise) {
                appealConfigPromise = fetch('/api/config')
                        .then(response => response.ok ? response.json() : {})
                        .catch(() => ({}))
                        .then(config => ({
                                deploymentReady: Boolean(config.deploymentReady),
                                appealHelpAmountCents: Number.isInteger(Number(config.appealHelpAmountCents))
                                        ? Number(config.appealHelpAmountCents)
                                        : 9900
                        }));
        }

        return appealConfigPromise;
}

function formatPaymentAmount(cents) {
        const amount = Number(cents);
        return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: amount % 100 === 0 ? 0 : 2
        }).format(Number.isFinite(amount) ? amount / 100 : 99);
}

function waitlistProfileFromProperty(user, propertyContext, address) {
        const details = propertyContext?.propertyDetails || {};
        const name = details.mailingName || user.displayName || user.email || 'Cook County Tax Compare User';
        const email = user.email || '';
        const phone = user.phoneNumber || '';
        const propertyLines = [
                `Property Address: ${address}`,
                propertyContext?.pin ? `PIN: ${propertyContext.pin}` : '',
                details.mailingName ? `Mailing Name: ${details.mailingName}` : '',
                details.mailingAddress ? `Mailing Address: ${details.mailingAddress}` : '',
                details.townshipName ? `Township: ${details.townshipName}` : '',
                details.municipalityName ? `Municipality: ${details.municipalityName}` : ''
        ].filter(Boolean);

        return {
                name,
                email,
                phone,
                message: [
                        'Signed-in user joined the property tax appeal waitlist from the dashboard.',
                        '',
                        ...propertyLines
                ].join('\n')
        };
}

async function updateAppealAddressSuggestions(query, forceVisible = false) {
        const suggestionsPanel = document.getElementById('appeal-address-suggestions');
        if (!suggestionsPanel) return;

        if (!query || query.trim().length < 3) {
                hideAddressSuggestions('appeal-address-suggestions');
                return;
        }

        suggestionsPanel.innerHTML = '<div class="address-suggestion-helper">Searching Cook County addresses...</div>';
        suggestionsPanel.classList.add('is-visible');

        try {
                const { authFetch } = await import('./auth-client.js?v=20260524-auth-gate');
                const response = await authFetch(`/api/address-lookup?q=${encodeURIComponent(query)}&limit=5`);
                if (!response.ok) {
                        const error = await response.json().catch(() => ({}));
                        renderAddressSuggestionMessage(
                                'appeal-address-suggestions',
                                error.error || 'Could not load address suggestions.'
                        );
                        return;
                }

                const data = await response.json();
                renderAddressSuggestions('appeal-address-suggestions', data.suggestions || [], (address) => {
                        const input = document.getElementById('appeal-address');
                        if (input) {
                                input.value = address;
                                input.focus();
                        }
                        selectedAppealAddressSuggestion = address;
                }, forceVisible ? 'Select the closest matching address before continuing.' : '');
        } catch (error) {
                console.error('Appeal address lookup failed:', error);
                renderAddressSuggestionMessage('appeal-address-suggestions', 'Could not load address suggestions.');
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
                ${suggestions.slice(0, 5).map(item => `
                <button type="button" class="address-suggestion" role="option" data-address="${escapeHtml(item.address)}">
                        ${escapeHtml(item.address)}
                        <span>PIN ${escapeHtml(item.pin || 'not available')}</span>
                </button>
        `).join('')}`;
        panel.classList.add('is-visible');

        panel.querySelectorAll('.address-suggestion').forEach(button => {
                button.addEventListener('click', () => {
                        onSelect(button.dataset.address);
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

function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, char => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
        })[char]);
}

// Mock flow for local testing
function mockPaymentFlow(address, userId) {
        console.log("Starting Mock Payment for", address);
        setTimeout(() => {
                // Redirect to return page with a fake session ID
                const fakeSessionId = "mock_session_" + Date.now();
                window.location.href = `return.html?session_id=${fakeSessionId}`;
        }, 1500);
}
