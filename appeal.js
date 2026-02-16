
// Appeal Modal Functionality

document.addEventListener('DOMContentLoaded', function () {
        initAppealModal();
});

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
                <p>Enter your property address to start the appeal process. We'll handle the rest.</p>
            </div>
            <form id="appeal-form">
                <div class="input-group">
                    <label for="appeal-address">Property Address</label>
                    <input type="text" id="appeal-address" placeholder="e.g. 123 Main St, Chicago, IL 60601" required>
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

export function openAppealModal() {
        const modal = document.getElementById('appeal-modal');
        if (modal) {
                modal.classList.add('show');
                document.getElementById('appeal-address').focus();
        } else {
                // Fallback if init didn't run or was delayed
                createAppealModalHTML();
                initAppealModal();
                setTimeout(() => document.getElementById('appeal-modal').classList.add('show'), 10);
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
        const address = document.getElementById('appeal-address').value;
        if (!address) {
                alert("Please enter your property address.");
                return;
        }

        // Get current user
        const { auth } = await import('./auth.js');
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
                const response = await fetch('/api/create-checkout-session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                                propertyAddress: address,
                                userId: user.uid
                        })
                });

                if (!response.ok) {
                        // API Call failed (e.g. 404 if running locally without Wrangler)
                        const text = await response.text();
                        console.error("API Error Response:", text);

                        // Fallback for local testing if API is missing (404)
                        if (response.status === 404 && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                                if (confirm("Backend API not found (running locally?). Use Mock Payment flow for testing?")) {
                                        mockPaymentFlow(address, user.uid);
                                        return;
                                }
                        }

                        throw new Error(`Server returned ${response.status}: ${text || response.statusText}`);
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

// Mock flow for local testing
function mockPaymentFlow(address, userId) {
        console.log("Starting Mock Payment for", address);
        setTimeout(() => {
                // Redirect to return page with a fake session ID
                const fakeSessionId = "mock_session_" + Date.now();
                window.location.href = `return.html?session_id=${fakeSessionId}`;
        }, 1500);
}
