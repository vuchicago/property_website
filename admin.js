import { auth } from './auth.js';

let currentUserEmail = null;
let currentRole = null;

// Wait for Auth to initialize before checking admin status
auth.onAuthStateChanged(async (user) => {
        if (user) {
                currentUserEmail = user.email;
                await checkAdminAccess();
        } else {
                document.getElementById('unauthorized-msg').innerHTML = '<h2>Access Denied</h2><p>You must log in to view this page. <a href="login.html">Login</a></p>';
        }
});

async function checkAdminAccess() {
        try {
                const response = await fetch(`/api/admin/roles?email=${encodeURIComponent(currentUserEmail)}&checkRoleOnly=true`);

                if (response.ok) {
                        const data = await response.json();
                        currentRole = data.role;

                        // Authorized
                        document.getElementById('unauthorized-msg').style.display = 'none';
                        document.getElementById('admin-dashboard').style.display = 'block';
                        document.getElementById('admin-badge').textContent = currentRole === 'superadmin' ? 'Super Admin' : 'Admin';

                        // Show roles tab only for superadmin
                        if (currentRole === 'superadmin') {
                                document.getElementById('roles-tab').style.display = 'block';
                                await loadRoles();
                        }

                        setupTabs();
                        await loadPendingAppeals();

                        if (currentRole === 'superadmin') {
                                setupRoleForm();
                        }

                } else {
                        // Unauthorized
                        document.getElementById('unauthorized-msg').innerHTML = '<h2>Unauthorized</h2><p>You do not have administrator privileges to view this page.</p>';
                }
        } catch (error) {
                console.error("Admin check failed:", error);
                document.getElementById('unauthorized-msg').innerHTML = '<h2>Error</h2><p>Failed to verify administrator status.</p>';
        }
}

function setupTabs() {
        const tabs = document.querySelectorAll('.admin-tab');
        tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                        // Deactivate all
                        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
                        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                        // Activate selected
                        tab.classList.add('active');
                        document.getElementById(tab.dataset.tab).classList.add('active');
                });
        });
}

async function loadPendingAppeals() {
        const tbody = document.querySelector('#appeals-table tbody');
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';

        try {
                const response = await fetch(`/api/admin/appeals?email=${encodeURIComponent(currentUserEmail)}`);
                if (!response.ok) throw new Error('Failed to fetch appeals');

                const appeals = await response.json();

                if (appeals.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No pending appeals found.</td></tr>';
                        return;
                }

                let html = '';
                appeals.forEach(appeal => {
                        const date = appeal.payment_date ? new Date(appeal.payment_date).toLocaleString() : 'N/A';
                        const amount = appeal.payment_amount ? `$${(appeal.payment_amount / 100).toFixed(2)}` : 'N/A';

                        html += `
                <tr>
                    <td><strong>${appeal.property_address}</strong></td>
                    <td>${appeal.customer_email || 'N/A'}</td>
                    <td>${date}<br><small class="text-muted">${amount}</small></td>
                    <td><span class="status-badge status-pending">${appeal.appeal_status}</span></td>
                    <td class="action-btns">
                        <button class="btn-sm btn-primary action-btn" data-id="${appeal.transaction_id}" data-action="Success">Mark Success</button>
                        <button class="btn-sm btn-secondary action-btn" data-id="${appeal.transaction_id}" data-action="Denied" style="background:var(--error-bg);color:var(--error);">Mark Denied</button>
                    </td>
                </tr>
            `;
                });
                tbody.innerHTML = html;

                // Attach listeners
                document.querySelectorAll('.action-btn').forEach(btn => {
                        btn.addEventListener('click', handleAppealAction);
                });

        } catch (error) {
                console.error("Error loading appeals:", error);
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--error);">Error loading appeals</td></tr>';
        }
}

async function handleAppealAction(e) {
        const btn = e.currentTarget;
        const transactionId = btn.dataset.id;
        const newStatus = btn.dataset.action;

        if (!confirm(`Are you sure you want to mark this appeal as ${newStatus}?`)) return;

        btn.textContent = 'Updating...';
        btn.disabled = true;

        try {
                const response = await fetch('/api/admin/appeals', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: currentUserEmail, transactionId, newStatus })
                });

                if (response.ok) {
                        await loadPendingAppeals(); // Refresh list
                } else {
                        const err = await response.json();
                        alert(`Failed to update: ${err.error}`);
                        btn.textContent = newStatus === 'Success' ? 'Mark Success' : 'Mark Denied';
                        btn.disabled = false;
                }
        } catch (error) {
                console.error("Error updating appeal:", error);
                alert('An error occurred.');
                btn.textContent = newStatus === 'Success' ? 'Mark Success' : 'Mark Denied';
                btn.disabled = false;
        }
}

// -----------------------------------------
// Super Admin Role Management Functions
// -----------------------------------------

async function loadRoles() {
        const tbody = document.querySelector('#roles-table tbody');
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading...</td></tr>';

        try {
                const response = await fetch(`/api/admin/roles?email=${encodeURIComponent(currentUserEmail)}`);
                if (!response.ok) throw new Error('Failed to fetch roles');

                const roles = await response.json();

                let html = '';
                roles.forEach(r => {
                        const isSelf = r.email === currentUserEmail;
                        html += `
                <tr>
                    <td><strong>${r.email}</strong> ${isSelf ? '<span class="text-muted">(You)</span>' : ''}</td>
                    <td><span class="status-badge" style="background: ${r.role === 'superadmin' ? 'var(--primary-light)' : 'var(--bg-secondary)'};">${r.role}</span></td>
                    <td>
                        <button class="btn-sm btn-secondary delete-role-btn" data-email="${r.email}" ${r.email === 'vu@cookcountytaxcompare.com' ? 'disabled' : ''}>Revoke Access</button>
                    </td>
                </tr>
            `;
                });
                tbody.innerHTML = html;

                // Attach listeners
                document.querySelectorAll('.delete-role-btn').forEach(btn => {
                        btn.addEventListener('click', handleDeleteRole);
                });

        } catch (error) {
                console.error("Error loading roles:", error);
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--error);">Error loading roles</td></tr>';
        }
}

function setupRoleForm() {
        const form = document.getElementById('add-admin-form');
        form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const newAdminEmail = document.getElementById('new-admin-email').value.trim();
                const role = document.getElementById('new-admin-role').value;
                const btn = form.querySelector('button[type="submit"]');

                btn.disabled = true;
                btn.textContent = 'Adding...';

                try {
                        const response = await fetch('/api/admin/roles', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ superEmail: currentUserEmail, newAdminEmail, role })
                        });

                        if (response.ok) {
                                document.getElementById('new-admin-email').value = '';
                                await loadRoles();
                        } else {
                                const err = await response.json();
                                alert(`Failed to add admin: ${err.error}`);
                        }
                } catch (error) {
                        console.error("Error adding admin:", error);
                        alert('An error occurred.');
                } finally {
                        btn.disabled = false;
                        btn.textContent = 'Add Admin';
                }
        });
}

async function handleDeleteRole(e) {
        const btn = e.currentTarget;
        const removeEmail = btn.dataset.email;

        if (!confirm(`Are you sure you want to revoke admin access for ${removeEmail}?`)) return;

        btn.textContent = 'Removing...';
        btn.disabled = true;

        try {
                const response = await fetch('/api/admin/roles', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ superEmail: currentUserEmail, removeEmail })
                });

                if (response.ok) {
                        await loadRoles();
                } else {
                        const err = await response.json();
                        alert(`Failed to remove admin: ${err.error}`);
                        btn.textContent = 'Revoke Access';
                        btn.disabled = false;
                }
        } catch (error) {
                console.error("Error removing admin:", error);
                alert('An error occurred.');
                btn.textContent = 'Revoke Access';
                btn.disabled = false;
        }
}
