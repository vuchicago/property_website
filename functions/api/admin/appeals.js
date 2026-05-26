import { requireAdminAccount, jsonResponse, normalizeEmail } from './_admin.js';

export const onRequestGet = async (context) => {
        const url = new URL(context.request.url);
        const searchEmail = (url.searchParams.get('searchEmail') || '').trim();

        const { response } = await requireAdminAccount(context);
        if (response) {
                return response;
        }

        try {
                let query;
                let sql;
                let statement;

                if (searchEmail) {
                        query = `%${searchEmail.toLowerCase()}%`;
                        sql = `SELECT id, transaction_id, customer_id, customer_name, customer_email, property_address, property_key, property_pin, payment_amount, payment_status, payment_date, appeal_status, appeal_date, assigned_partner_email, assigned_partner_at, partner_status, created_at
                               FROM appeals
                               WHERE lower(customer_email) LIKE ?
                               ORDER BY payment_date DESC, created_at DESC`;
                        statement = context.env.DB.prepare(sql).bind(query);
                } else {
                        sql = `SELECT id, transaction_id, customer_id, customer_name, customer_email, property_address, property_key, property_pin, payment_amount, payment_status, payment_date, appeal_status, appeal_date, assigned_partner_email, assigned_partner_at, partner_status, created_at
                               FROM appeals
                               WHERE appeal_status = 'Pending'
                               ORDER BY payment_date ASC`;
                        statement = context.env.DB.prepare(sql);
                }

                let results;
                try {
                        ({ results } = await statement.all());
                } catch (error) {
                        if (!error.message.includes('customer_name')) {
                                throw error;
                        }

                        if (searchEmail) {
                                statement = context.env.DB.prepare(
                                        `SELECT id, transaction_id, customer_id, NULL AS customer_name, customer_email, property_address, property_key, property_pin, payment_amount, payment_status, payment_date, appeal_status, appeal_date, NULL AS assigned_partner_email, NULL AS assigned_partner_at, NULL AS partner_status, created_at
                                         FROM appeals
                                         WHERE lower(customer_email) LIKE ?
                                         ORDER BY payment_date DESC, created_at DESC`
                                ).bind(query);
                        } else {
                                statement = context.env.DB.prepare(
                                        `SELECT id, transaction_id, customer_id, NULL AS customer_name, customer_email, property_address, property_key, property_pin, payment_amount, payment_status, payment_date, appeal_status, appeal_date, NULL AS assigned_partner_email, NULL AS assigned_partner_at, NULL AS partner_status, created_at
                                         FROM appeals
                                         WHERE appeal_status = 'Pending'
                                         ORDER BY payment_date ASC`
                                );
                        }

                        ({ results } = await statement.all());
                }

                return jsonResponse(results);
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};

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

                const result = await context.env.DB.prepare(
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
