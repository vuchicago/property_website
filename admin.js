import { auth, authFetch } from './auth-client.js';

const PRIMARY_SUPERADMIN_EMAIL = 'vuchicago@gmail.com';

let currentUserEmail = null;
let currentRole = null;
let partners = [];

auth.onAuthStateChanged(async (user) => {
        if (!user) {
                showUnauthorized('<h2>Access Denied</h2><p>You must log in to view this page. <a href="login.html">Login</a></p>');
                return;
        }

        currentUserEmail = normalizeEmail(user.email);
        await checkAccountAccess();
});

async function checkAccountAccess() {
        try {
                const response = await authFetch('/api/admin/roles?checkRoleOnly=true');

                if (!response.ok) {
                        showUnauthorized('<h2>Unauthorized</h2><p>You do not have administrator or partner privileges to view this page.</p>');
                        return;
                }

                const data = await response.json();
                currentRole = data.role;

                document.getElementById('unauthorized-msg').style.display = 'none';
                document.getElementById('admin-dashboard').style.display = 'block';
                document.getElementById('admin-badge').textContent = roleLabel(currentRole);

                setupTabs();

                if (currentRole === 'partner') {
                        showPartnerDashboard();
                        await loadPartnerInbox();
                        return;
                }

                await loadPartners();
                await loadAdminNotifications();
                setupHistorySearch();
                await loadPendingAppeals();

                if (currentRole === 'superadmin') {
                        document.getElementById('roles-tab').style.display = 'block';
                        setupRoleForm();
                        await loadRoles();
                }
        } catch (error) {
                console.error('Account check failed:', error);
                showUnauthorized('<h2>Error</h2><p>Failed to verify account access.</p>');
        }
}

function showUnauthorized(html) {
        document.getElementById('unauthorized-msg').innerHTML = html;
}

function showPartnerDashboard() {
        document.querySelector('[data-tab="appeals"]').textContent = 'Inbox';
        document.querySelector('[data-tab="history"]').style.display = 'none';
        document.getElementById('appeals').classList.add('active');
        document.getElementById('history').classList.remove('active');
        document.getElementById('partner-inbox').style.display = 'block';
        document.getElementById('admin-appeals-panel').style.display = 'none';
}

function setupTabs() {
        document.querySelectorAll('.admin-tab').forEach(tab => {
                if (tab.dataset.bound === 'true') return;
                tab.dataset.bound = 'true';
                tab.addEventListener('click', () => {
                        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
                        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                        tab.classList.add('active');
                        document.getElementById(tab.dataset.tab).classList.add('active');
                });
        });
}

async function loadPartners() {
        const response = await authFetch('/api/admin/partners');
        if (!response.ok) {
                partners = [];
                return;
        }

        const data = await response.json();
        partners = Array.isArray(data.partners) ? data.partners : [];
}

async function loadPendingAppeals() {
        const tbody = document.querySelector('#appeals-table tbody');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading...</td></tr>';

        try {
                const response = await authFetch('/api/admin/appeals');
                if (!response.ok) throw new Error('Failed to fetch appeals');

                const appeals = await response.json();
                if (!appeals.length) {
                        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No pending appeals found.</td></tr>';
                        return;
                }

                tbody.innerHTML = appeals.map(appeal => {
                        const date = appeal.payment_date ? new Date(appeal.payment_date).toLocaleString() : 'N/A';
                        const amount = appeal.payment_amount ? `$${(appeal.payment_amount / 100).toFixed(2)}` : 'N/A';
                        return `
                                <tr>
                                        <td><strong>${escapeHtml(appeal.property_address)}</strong>${appeal.property_pin ? `<br><small class="text-muted">PIN ${escapeHtml(appeal.property_pin)}</small>` : ''}</td>
                                        <td>${escapeHtml(appeal.customer_name || 'N/A')}<br><small class="text-muted">${escapeHtml(appeal.customer_email || 'N/A')}</small></td>
                                        <td>${date}<br><small class="text-muted">${amount}</small></td>
                                        <td><span class="status-badge status-pending">${escapeHtml(appeal.appeal_status || 'Pending')}</span></td>
                                        <td>${renderPartnerSelect(appeal)}</td>
                                        <td class="action-btns">
                                                <button class="btn-sm btn-primary action-btn" data-id="${escapeHtml(appeal.transaction_id)}" data-action="Finished">Mark Finished</button>
                                                <button class="btn-sm btn-secondary action-btn" data-id="${escapeHtml(appeal.transaction_id)}" data-action="Denied" style="background:var(--error-bg);color:var(--error);">Mark Denied</button>
                                        </td>
                                </tr>
                        `;
                }).join('');

                document.querySelectorAll('.action-btn').forEach(btn => btn.addEventListener('click', handleAppealAction));
                document.querySelectorAll('.partner-assignment-select').forEach(select => select.addEventListener('change', handlePartnerAssignment));
        } catch (error) {
                console.error('Error loading appeals:', error);
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--error);">Error loading appeals</td></tr>';
        }
}

async function loadAdminNotifications() {
        const container = document.getElementById('admin-notifications');
        if (!container) return;

        try {
                const response = await authFetch('/api/admin/notifications');
                if (!response.ok) return;

                const data = await response.json();
                const notifications = data.notifications || [];
                const unread = notifications.filter(item => !item.is_read).length;
                const latest = notifications[0];

                if (!latest) {
                        container.style.display = 'none';
                        return;
                }

                container.style.display = 'flex';
                container.innerHTML = `
                        <div>
                                <strong>${unread} unread notification${unread === 1 ? '' : 's'}</strong>
                                <div class="text-sm text-muted">${escapeHtml(latest.message || latest.title)}</div>
                        </div>
                        <button type="button" class="btn btn-secondary btn-sm" id="mark-admin-notifications-read">Mark read</button>
                `;

                document.getElementById('mark-admin-notifications-read')?.addEventListener('click', markAdminNotificationsRead);
        } catch (error) {
                console.error('Error loading admin notifications:', error);
        }
}

async function markAdminNotificationsRead() {
        await authFetch('/api/admin/notifications', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
        });
        await loadAdminNotifications();
}

function renderPartnerSelect(appeal) {
        if (!partners.length) {
                return '<span class="text-sm text-muted">Add partner accounts in Role Management.</span>';
        }

        const selected = normalizeEmail(appeal.assigned_partner_email);
        const options = [
                '<option value="">Unassigned</option>',
                ...partners.map(partner => {
                        const email = normalizeEmail(partner.email);
                        return `<option value="${escapeHtml(email)}" ${email === selected ? 'selected' : ''}>${escapeHtml(email)}</option>`;
                })
        ].join('');

        return `
                <select class="partner-assignment-select" data-id="${escapeHtml(appeal.transaction_id)}" aria-label="Assign partner">
                        ${options}
                </select>
                ${selected ? `<small class="text-muted">Assigned ${appeal.assigned_partner_at ? new Date(appeal.assigned_partner_at).toLocaleDateString() : ''}</small>` : ''}
        `;
}

async function handlePartnerAssignment(event) {
        const select = event.currentTarget;
        select.disabled = true;

        try {
                const response = await authFetch('/api/admin/appeals', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                                transactionId: select.dataset.id,
                                partnerEmail: select.value
                        })
                });

                if (!response.ok) {
                        const err = await response.json();
                        alert(`Failed to assign partner: ${err.error}`);
                }

                await loadPendingAppeals();
        } catch (error) {
                console.error('Error assigning partner:', error);
                alert('An error occurred while assigning the partner.');
                select.disabled = false;
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
                const response = await authFetch('/api/admin/appeals', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ transactionId, newStatus })
                });

                if (response.ok) {
                        await loadPendingAppeals();
                } else {
                        const err = await response.json();
                        alert(`Failed to update: ${err.error}`);
                        btn.disabled = false;
                }
        } catch (error) {
                console.error('Error updating appeal:', error);
                alert('An error occurred.');
                btn.disabled = false;
        }
}

async function loadPartnerInbox() {
        const container = document.getElementById('partner-inbox');
        container.innerHTML = '<p class="text-muted">Loading assigned appeals...</p>';

        try {
                const response = await authFetch('/api/partner/appeals');
                if (!response.ok) throw new Error('Failed to load partner inbox');

                const data = await response.json();
                const appeals = data.appeals || [];
                const unread = (data.notifications || []).filter(item => !item.is_read).length;

                if (!appeals.length) {
                        container.innerHTML = '<p class="text-muted">No assigned appeals yet.</p>';
                        return;
                }

                container.innerHTML = `
                        <div class="partner-inbox-header">
                                <strong>${appeals.length} assigned appeal${appeals.length === 1 ? '' : 's'}</strong>
                                <span class="text-muted">${unread} unread notification${unread === 1 ? '' : 's'}</span>
                                <button type="button" class="btn btn-secondary btn-sm" id="mark-notifications-read">Mark read</button>
                        </div>
                        <div class="partner-appeal-list">
                                ${appeals.map(renderPartnerAppeal).join('')}
                        </div>
                `;

                document.getElementById('mark-notifications-read')?.addEventListener('click', markPartnerNotificationsRead);
        } catch (error) {
                console.error('Error loading partner inbox:', error);
                container.innerHTML = '<p style="color: var(--error);">Partner inbox could not be loaded.</p>';
        }
}

function renderPartnerAppeal(appeal) {
        const amount = appeal.payment_amount ? `$${(appeal.payment_amount / 100).toFixed(2)}` : 'N/A';
        const date = appeal.assigned_partner_at ? new Date(appeal.assigned_partner_at).toLocaleString() : 'N/A';
        const files = appeal.files || {};
        const documents = files.supportingDocuments || [];

        return `
                <article class="partner-appeal-card">
                        <div>
                                <h4>${escapeHtml(appeal.property_address || 'Property')}</h4>
                                <p class="text-sm text-muted">${escapeHtml(appeal.customer_name || 'Customer')} · ${escapeHtml(appeal.customer_email || 'No email')}</p>
                                <p class="text-sm text-muted">Assigned ${date} · Payment ${amount} · Status ${escapeHtml(appeal.appeal_status || 'Pending')}</p>
                                ${appeal.property_pin ? `<p class="text-sm text-muted">PIN ${escapeHtml(appeal.property_pin)}</p>` : ''}
                        </div>
                        <div class="partner-file-grid">
                                ${renderFilePreview('Property Image', files.propertyImage, files.missing?.propertyImage)}
                                ${renderFilePreview('Government ID', files.governmentId, files.missing?.governmentId)}
                        </div>
                        <div class="partner-documents">
                                <strong>Supporting Documents</strong>
                                ${documents.length ? documents.map(doc => renderDocumentLink(doc)).join('') : '<span class="text-sm text-muted">No optional supporting documents uploaded.</span>'}
                        </div>
                </article>
        `;
}

function renderFilePreview(label, file, missing) {
        if (missing || !file) {
                return `<div class="partner-file-missing"><strong>${label}</strong><span>Missing</span></div>`;
        }

        const href = escapeHtml(file.image_data);
        const uploadedAt = file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : '';
        return `
                <a class="partner-file-preview" href="${href}" target="_blank" rel="noopener">
                        <strong>${label}</strong>
                        <img src="${href}" alt="${escapeHtml(label)}">
                        <span>${escapeHtml(uploadedAt)}</span>
                </a>
        `;
}

function renderDocumentLink(doc) {
        return `
                <a class="partner-document-link" href="${escapeHtml(doc.file_data)}" target="_blank" rel="noopener">
                        ${escapeHtml(doc.file_name || 'Document')}
                        <span>${escapeHtml(doc.mime_type || '')}</span>
                </a>
        `;
}

async function markPartnerNotificationsRead() {
        await authFetch('/api/partner/appeals', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
        });
        await loadPartnerInbox();
}

function setupHistorySearch() {
        const form = document.getElementById('history-search-form');
        if (!form || form.dataset.bound === 'true') return;
        form.dataset.bound = 'true';

        form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await loadUserHistory(document.getElementById('history-search-email').value.trim());
        });
}

async function loadUserHistory(searchEmail) {
        const tbody = document.querySelector('#history-table tbody');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Searching...</td></tr>';

        try {
                const response = await authFetch(`/api/admin/appeals?searchEmail=${encodeURIComponent(searchEmail)}`);
                if (!response.ok) throw new Error('Failed to fetch user history');

                const appeals = await response.json();
                if (!appeals.length) {
                        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No appeals found for this email.</td></tr>';
                        return;
                }

                tbody.innerHTML = appeals.map(appeal => {
                        const date = appeal.payment_date ? new Date(appeal.payment_date).toLocaleString() : 'N/A';
                        const amount = appeal.payment_amount ? `$${(appeal.payment_amount / 100).toFixed(2)}` : 'N/A';
                        return `
                                <tr>
                                        <td>${escapeHtml(appeal.customer_name || 'N/A')}</td>
                                        <td>${escapeHtml(appeal.customer_email || 'N/A')}</td>
                                        <td><strong>${escapeHtml(appeal.property_address || 'N/A')}</strong></td>
                                        <td>${date}<br><small class="text-muted">${amount}</small></td>
                                        <td><span class="status-badge ${getStatusClass(appeal.appeal_status)}">${escapeHtml(appeal.appeal_status || 'Pending')}</span></td>
                                        <td>${escapeHtml(appeal.assigned_partner_email || 'Unassigned')}</td>
                                </tr>
                        `;
                }).join('');
        } catch (error) {
                console.error('Error loading user history:', error);
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--error);">Error loading history</td></tr>';
        }
}

async function loadRoles() {
        const tbody = document.querySelector('#roles-table tbody');
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading...</td></tr>';

        try {
                const response = await authFetch('/api/admin/roles');
                if (!response.ok) throw new Error('Failed to fetch roles');

                const roles = await response.json();
                tbody.innerHTML = roles.map(r => {
                        const isSelf = normalizeEmail(r.email) === currentUserEmail;
                        const isPrimary = normalizeEmail(r.email) === PRIMARY_SUPERADMIN_EMAIL;
                        return `
                                <tr>
                                        <td><strong>${escapeHtml(r.email)}</strong> ${isSelf ? '<span class="text-muted">(You)</span>' : ''}</td>
                                        <td><span class="status-badge role-badge-${escapeHtml(r.role)}">${escapeHtml(roleLabel(r.role))}</span></td>
                                        <td><button class="btn-sm btn-secondary delete-role-btn" data-email="${escapeHtml(r.email)}" ${isPrimary ? 'disabled' : ''}>Revoke Access</button></td>
                                </tr>
                        `;
                }).join('');

                document.querySelectorAll('.delete-role-btn').forEach(btn => btn.addEventListener('click', handleDeleteRole));
        } catch (error) {
                console.error('Error loading roles:', error);
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--error);">Error loading roles</td></tr>';
        }
}

function setupRoleForm() {
        const form = document.getElementById('add-admin-form');
        if (!form || form.dataset.bound === 'true') return;
        form.dataset.bound = 'true';

        form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const newAdminEmail = document.getElementById('new-admin-email').value.trim();
                const role = document.getElementById('new-admin-role').value;
                const btn = form.querySelector('button[type="submit"]');

                btn.disabled = true;
                btn.textContent = 'Adding...';

                try {
                        const response = await authFetch('/api/admin/roles', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ newAdminEmail, role })
                        });

                        if (!response.ok) {
                                const err = await response.json();
                                alert(`Failed to add account: ${err.error}`);
                        } else {
                                document.getElementById('new-admin-email').value = '';
                                await loadRoles();
                                await loadPartners();
                                await loadPendingAppeals();
                        }
                } catch (error) {
                        console.error('Error adding account:', error);
                        alert('An error occurred.');
                } finally {
                        btn.disabled = false;
                        btn.textContent = 'Add Account';
                }
        });
}

async function handleDeleteRole(e) {
        const btn = e.currentTarget;
        const removeEmail = btn.dataset.email;

        if (!confirm(`Are you sure you want to revoke access for ${removeEmail}?`)) return;

        btn.textContent = 'Removing...';
        btn.disabled = true;

        try {
                const response = await authFetch('/api/admin/roles', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ removeEmail })
                });

                if (!response.ok) {
                        const err = await response.json();
                        alert(`Failed to remove access: ${err.error}`);
                }

                await loadRoles();
                await loadPartners();
                await loadPendingAppeals();
        } catch (error) {
                console.error('Error removing account:', error);
                alert('An error occurred.');
                btn.disabled = false;
        }
}

function getStatusClass(status) {
        switch ((status || '').toLowerCase()) {
                case 'success':
                case 'finished':
                        return 'status-success';
                case 'denied':
                        return 'status-error';
                case 'pending':
                        return 'status-pending';
                default:
                        return 'status-neutral';
        }
}

function roleLabel(role) {
        if (role === 'superadmin') return 'Super Admin';
        if (role === 'partner') return 'Partner';
        return 'Admin';
}

function normalizeEmail(value) {
        return String(value || '').trim().toLowerCase();
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
