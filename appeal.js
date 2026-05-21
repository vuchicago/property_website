
// Appeal Modal Functionality

document.addEventListener('DOMContentLoaded', function () {
        initAppealModal();
});

let selectedAppealAddressSuggestion = '';

function initAppealModal() {
        // We will dynamically create the modal HTML to keep index.html clean
        createAppealModalHTML();

        const modal = document.getElementById('appeal-modal');
        const closeBtn = document.getElementById('close-appeal-modal');
        const form = document.getElementById('appeal-form');
        const payBtn = document.getElementById('pay-appeal-btn');

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

        // Handle form submission (Pay button)
        form?.addEventListener('submit', (e) => {
                e.preventDefault();
                handleAppealPayment();
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
                <h2>Appeal Your Property Tax</h2>
                <p id="appeal-modal-subtitle">Enter your property address to start the appeal process. We'll handle the rest.</p>
            </div>
            <form id="appeal-form">
                <div class="input-group">
                    <label for="appeal-address">Property Address</label>
                    <div class="address-search-wrap">
                        <input type="text" id="appeal-address" autocomplete="off" aria-autocomplete="list" aria-controls="appeal-address-suggestions" placeholder="e.g. 123 Main St, Chicago, IL 60601" required>
                        <div id="appeal-address-suggestions" class="address-suggestions" role="listbox"></div>
                    </div>
                </div>
                <!-- Hidden fields for user info if needed later -->
                <div class="modal-actions">
                    <button type="submit" class="btn btn-primary btn-full" id="pay-appeal-btn">
                        Pay $99 & Submit Appeal
                    </button>
                    <p class="secure-note">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        Secure payment via Stripe
                    </p>
                </div>
            </form>
        </div>
    `;
        document.body.appendChild(modal);
}

export function openAppealModal(propertyAddress = '') {
        const modal = document.getElementById('appeal-modal');
        if (modal) {
                setAppealAddress(propertyAddress);
                modal.classList.add('show');
                const addressInput = document.getElementById('appeal-address');
                const payBtn = document.getElementById('pay-appeal-btn');
                if (propertyAddress && payBtn) {
                        payBtn.focus();
                } else if (addressInput) {
                        addressInput.focus();
                }
        } else {
                // Fallback if init didn't run or was delayed
                createAppealModalHTML();
                initAppealModal();
                setTimeout(() => {
                        setAppealAddress(propertyAddress);
                        document.getElementById('appeal-modal').classList.add('show');
                }, 10);
        }
}

function setAppealAddress(propertyAddress = '') {
        const addressInput = document.getElementById('appeal-address');
        const subtitle = document.getElementById('appeal-modal-subtitle');

        if (!addressInput) {
                return;
        }

        addressInput.value = propertyAddress;
        addressInput.readOnly = Boolean(propertyAddress);
        selectedAppealAddressSuggestion = propertyAddress;
        hideAddressSuggestions('appeal-address-suggestions');

        if (subtitle) {
                subtitle.textContent = propertyAddress
                        ? 'This appeal will use the property already saved in your account.'
                        : "Enter your property address to start the appeal process. We'll handle the rest.";
        }
}

function closeAppealModal() {
        const modal = document.getElementById('appeal-modal');
        if (modal) {
                modal.classList.remove('show');
        }
}

// Initialize Stripe
let stripe;

async function getStripe() {
        if (stripe) return stripe;
        try {
                const res = await fetch('/api/config');
                const { publishableKey } = await res.json();
                if (!publishableKey) throw new Error('Missing Publishable Key');
                stripe = Stripe(publishableKey);
                return stripe;
        } catch (err) {
                console.error('Failed to load Stripe config:', err);
                return null;
        }
}

async function handleAppealPayment() {
        const addressInput = document.getElementById('appeal-address');
        const address = selectedAppealAddressSuggestion;
        const typedAddress = addressInput.value.trim();
        if (!address && typedAddress) {
                await updateAppealAddressSuggestions(typedAddress, true);
                addressInput.focus();
                return;
        }

        if (!address) {
                alert("Please enter your property address.");
                return;
        }

        // Get current user
        const { auth, authFetch } = await import('./auth.js');
        const user = auth.currentUser;

        if (!user) {
                alert("Please log in to continue.");
                window.location.href = 'login.html';
                return;
        }

        const btn = document.getElementById('pay-appeal-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Processing...';
        btn.disabled = true;

        try {
                const response = await authFetch('/api/create-checkout-session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                                propertyAddress: address
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

                const text = await response.text();
                if (!text) throw new Error("Server returned empty response");

                let data;
                try {
                        data = JSON.parse(text);
                } catch (e) {
                        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}...`);
                }

                if (data.error) {
                        throw new Error(data.error);
                }

                if (data.url) {
                        window.location.href = data.url;
                } else {
                        throw new Error("No checkout URL returned");
                }

        } catch (error) {
                console.error("Payment initiation failed:", error);
                alert("Failed to start payment: " + error.message);
                btn.innerHTML = originalText;
                btn.disabled = false;
        }
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
                const { authFetch } = await import('./auth.js');
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
