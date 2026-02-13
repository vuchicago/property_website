
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
                        Pay $20 & Submit Appeal
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

function handleAppealPayment() {
        const address = document.getElementById('appeal-address').value;
        if (!address) {
                alert("Please enter your property address.");
                return;
        }

        const btn = document.getElementById('pay-appeal-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Redirecting...';
        btn.disabled = true;

        // TODO: Replace with your actual Stripe Payment Link
        // You can pass the address as a prefilled field if your Stripe link supports it,
        // or rely on Stripe to collect the address (billing address).
        // For now, we will just redirect to a placeholder.

        // Example with prefilled email if we had it: ?prefilled_email=${userEmail}
        const STRIPE_LINK = "https://buy.stripe.com/test_placeholder";

        setTimeout(() => {
                window.open(STRIPE_LINK, '_blank');
                btn.innerHTML = originalText;
                btn.disabled = false;
                closeAppealModal();
                alert("Redirecting to payment provider. Please complete your payment to finalize the appeal.");
        }, 1000);
}
