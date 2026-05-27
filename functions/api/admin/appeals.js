import { requireAdminAccount, jsonResponse, normalizeEmail } from './_admin.js';

export const onRequestGet = async (context) => {
        const url = new URL(context.request.url);
        const searchEmail = (url.searchParams.get('searchEmail') || '').trim();

        const { response } = await requireAdminAccount(context);
        if (response) {
                return response;
        }

        try {
                const columns = await getAppealsColumns(context.env.DB);
                const selectList = buildAppealSelectList(columns);
                const orderBy = columns.has('payment_date')
                        ? 'payment_date ASC, created_at ASC'
                        : 'created_at ASC';
                const historyOrderBy = columns.has('payment_date')
                        ? 'payment_date DESC, created_at DESC'
                        : 'created_at DESC';
                const pendingWhere = columns.has('appeal_status')
                        ? "COALESCE(appeal_status, 'Pending') = 'Pending'"
                        : "'Pending' = 'Pending'";

                if (searchEmail) {
                        const query = `%${searchEmail.toLowerCase()}%`;
                        const { results } = await context.env.DB.prepare(
                                `SELECT ${selectList}
                               FROM appeals
                               WHERE lower(customer_email) LIKE ?
                               ORDER BY ${historyOrderBy}`
                        ).bind(query).all();

                        return jsonResponse(results);
                }

                const { results } = await context.env.DB.prepare(
                        `SELECT ${selectList}
                         FROM appeals
                         WHERE ${pendingWhere}
                           AND payment_status = 'paid'
                         ORDER BY ${orderBy}`
                ).all();

                return jsonResponse(results);
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};

async function getAppealsColumns(db) {
        const { results } = await db.prepare("PRAGMA table_info(appeals)").all();
        return new Set((results || []).map(column => column.name));
}

function buildAppealSelectList(columns) {
        return [
                appealColumn(columns, 'id'),
                appealColumn(columns, 'transaction_id'),
                appealColumn(columns, 'customer_id'),
                appealColumn(columns, 'customer_name'),
                appealColumn(columns, 'customer_email'),
                appealColumn(columns, 'property_address'),
                appealColumn(columns, 'property_key'),
                appealColumn(columns, 'property_pin'),
                appealColumn(columns, 'payment_amount'),
                appealColumn(columns, 'payment_status'),
                appealColumn(columns, 'payment_date'),
                appealColumn(columns, 'appeal_status', "'Pending'"),
                appealColumn(columns, 'appeal_date'),
                appealColumn(columns, 'assigned_partner_email'),
                appealColumn(columns, 'assigned_partner_at'),
                appealColumn(columns, 'partner_status'),
                appealColumn(columns, 'completed_by_email'),
                appealColumn(columns, 'created_at')
        ].join(', ');
}

function appealColumn(columns, column, fallback = 'NULL') {
        return columns.has(column) ? column : `${fallback} AS ${column}`;
}

export const onRequestPut = async (context) => {
        const { user, response } = await requireAdminAccount(context);
        if (response) {
                return response;
        }

        try {
                const { transactionId, newStatus, partnerEmail } = await context.request.json();

                if (!transactionId) {
                        return jsonResponse({ error: 'Missing transaction ID' }, 400);
                }

                if (typeof partnerEmail !== 'undefined') {
                        return assignPartner(context, {
                                transactionId,
                                partnerEmail: normalizeEmail(partnerEmail),
                                adminEmail: user.email
                        });
                }

                if (!['Pending', 'Finished', 'Denied'].includes(newStatus)) {
                        return jsonResponse({ error: 'Invalid status' }, 400);
                }

                const columns = await getAppealsColumns(context.env.DB);
                const result = columns.has('completed_by_email')
                        ? await context.env.DB.prepare(
                                `UPDATE appeals
                                 SET appeal_status = ?,
                                     appeal_date = CASE WHEN ? = 'Finished' THEN CURRENT_TIMESTAMP ELSE appeal_date END,
                                     completed_by_email = CASE WHEN ? = 'Finished' THEN ? ELSE completed_by_email END
                                 WHERE transaction_id = ?`
                        ).bind(newStatus, newStatus, newStatus, user.email, transactionId).run()
                        : await context.env.DB.prepare(
                                `UPDATE appeals
                                 SET appeal_status = ?,
                                     appeal_date = CASE WHEN ? = 'Finished' THEN CURRENT_TIMESTAMP ELSE appeal_date END
                                 WHERE transaction_id = ?`
                        ).bind(newStatus, newStatus, transactionId).run();

                if (result.meta.changes === 0) {
                        return jsonResponse({ error: 'Appeal not found' }, 404);
                }

                return jsonResponse({ success: true });

        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};

async function assignPartner(context, { transactionId, partnerEmail, adminEmail }) {
        const columns = await getAppealsColumns(context.env.DB);
        const requiredColumns = ['assigned_partner_email', 'assigned_partner_at', 'assigned_by_admin_email', 'partner_status'];
        const missingColumns = requiredColumns.filter(column => !columns.has(column));
        if (missingColumns.length) {
                return jsonResponse({
                        error: `Assignment columns are missing. Apply the latest D1 migrations. Missing: ${missingColumns.join(', ')}`
                }, 500);
        }

        const appeal = await context.env.DB.prepare(
                `SELECT id, property_address
                 FROM appeals
                 WHERE transaction_id = ?
                 LIMIT 1`
        ).bind(transactionId).first();

        if (!appeal) {
                return jsonResponse({ error: 'Appeal not found' }, 404);
        }

        if (!partnerEmail) {
                await context.env.DB.prepare(
                        `UPDATE appeals
                         SET assigned_partner_email = NULL,
                             assigned_partner_at = NULL,
                             assigned_by_admin_email = NULL,
                             partner_status = NULL
                         WHERE transaction_id = ?`
                ).bind(transactionId).run();

                return jsonResponse({ success: true });
        }

        const partner = await context.env.DB.prepare(
                "SELECT email FROM admins WHERE email = ? AND role = 'partner'"
        ).bind(partnerEmail).first();

        if (!partner) {
                return jsonResponse({ error: 'Partner account not found. Add this email as a partner first.' }, 400);
        }

        await context.env.DB.prepare(
                `UPDATE appeals
                 SET assigned_partner_email = ?,
                     assigned_partner_at = CURRENT_TIMESTAMP,
                     assigned_by_admin_email = ?,
                     partner_status = 'Assigned'
                 WHERE transaction_id = ?`
        ).bind(partnerEmail, adminEmail, transactionId).run();

        await context.env.DB.prepare(
                `INSERT INTO account_notifications (recipient_email, recipient_role, appeal_id, notification_type, title, message)
                 VALUES (?, 'partner', ?, 'appeal_assigned', 'Property pending appeal', ?)`
        ).bind(
                partnerEmail,
                appeal.id,
                `${appeal.property_address || 'A property'} has been assigned to your partner account.`
        ).run();

        return jsonResponse({ success: true });
}
