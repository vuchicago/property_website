
import { db, auth } from './auth.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export async function loadAppealHistory() {
        const user = auth.currentUser;
        if (!user) return;

        const historyContainer = document.getElementById('appeal-history-list');
        if (!historyContainer) return;

        try {
                historyContainer.innerHTML = '<div class="loading-spinner">Loading history...</div>';

                // Query appeals for this user
                // Assuming collection structure: 'appeals' (root) with field 'userId' OR 'users/{uid}/appeals'
                const q = query(
                        collection(db, "users", user.uid, "appeals"),
                        orderBy("createdAt", "desc")
                );

                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                        historyContainer.innerHTML = '<p class="no-history">No appeals found. Start one today!</p>';
                        return;
                }

                let html = '<ul class="history-list">';
                querySnapshot.forEach((doc) => {
                        const data = doc.data();
                        const date = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
                        const statusClass = getStatusClass(data.status);

                        html += `
                <li class="history-item">
                    <div class="history-info">
                        <strong>${data.propertyAddress}</strong>
                        <span class="history-date">Submitted on ${date}</span>
                    </div>
                    <div class="history-status">
                         <span class="status-badge ${statusClass}">${capitalize(data.status || 'pending')}</span>
                         ${getActionButton(data)}
                    </div>
                </li>
            `;
                });
                html += '</ul>';
                historyContainer.innerHTML = html;

                // Add Event Listeners for buttons
                historyContainer.querySelectorAll('.appeal-again-btn').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                                const address = e.target.dataset.address;
                                // Import dynamically to ensure it's loaded
                                const { openAppealModal } = await import('./appeal.js');

                                // Pre-fill address
                                const addressInput = document.getElementById('appeal-address');
                                if (addressInput) addressInput.value = address;

                                openAppealModal();
                        });
                });

        } catch (error) {
                console.error("Error loading history:", error);
                historyContainer.innerHTML = `<p class="error-text">Failed to load history. Please try again.</p>`;
        }
}

function getStatusClass(status) {
        switch (status) {
                case 'completed': return 'status-success';
                case 'pending': return 'status-pending';
                case 'failed': return 'status-error';
                default: return 'status-neutral';
        }
}

function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
}

function getActionButton(data) {
        return `<button class="btn-sm btn-secondary appeal-again-btn" data-address="${data.propertyAddress}" style="margin-left: 1rem; padding: 0.25rem 0.5rem; font-size: 0.8rem;">Appeal Again</button>`;
}
