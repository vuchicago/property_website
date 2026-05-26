import { getAdminUser, jsonResponse } from '../admin/_admin.js';

export const onRequestGet = async (context) => {
        const { user, role, response } = await getAdminUser(context);
        if (response) return response;

        if (role !== 'partner') {
                return jsonResponse({ error: 'Unauthorized. Partner only.' }, 403);
        }

        try {
                const appealsResult = await context.env.DB.prepare(
                        `SELECT id, transaction_id, customer_id, customer_name, customer_email, property_address, property_key, property_pin,
                                payment_amount, payment_status, payment_date, appeal_status, assigned_partner_at, partner_status
                         FROM appeals
                         WHERE assigned_partner_email = ?
                         ORDER BY assigned_partner_at DESC, payment_date DESC, created_at DESC`
                ).bind(user.email).all();

                const appeals = [];
                for (const appeal of appealsResult.results || []) {
                        appeals.push({
                                ...appeal,
                                files: await loadAppealFiles(context.env.DB, appeal)
                        });
                }

                const notifications = await context.env.DB.prepare(
                        `SELECT id, appeal_id, notification_type, title, message, is_read, created_at
                         FROM account_notifications
                         WHERE recipient_email = ?
                         ORDER BY created_at DESC
                         LIMIT 50`
                ).bind(user.email).all();

                return jsonResponse({
                        appeals,
                        notifications: notifications.results || []
                });
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};

export const onRequestPut = async (context) => {
        const { user, role, response } = await getAdminUser(context);
        if (response) return response;

        if (role !== 'partner') {
                return jsonResponse({ error: 'Unauthorized. Partner only.' }, 403);
        }

        try {
                const { notificationId } = await context.request.json();

                if (!notificationId) {
                        await context.env.DB.prepare(
                                "UPDATE account_notifications SET is_read = 1 WHERE recipient_email = ?"
                        ).bind(user.email).run();
                } else {
                        await context.env.DB.prepare(
                                "UPDATE account_notifications SET is_read = 1 WHERE id = ? AND recipient_email = ?"
                        ).bind(notificationId, user.email).run();
                }

                return jsonResponse({ success: true });
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};

async function loadAppealFiles(db, appeal) {
        const pinList = String(appeal.property_pin || '')
                .split(',')
                .map(pin => pin.trim())
                .filter(Boolean)
                .join(',');
        const pinMatch = `,${pinList},`;

        const propertyImage = await db.prepare(
                `SELECT image_data, mime_type, uploaded_at
                 FROM property_images
                 WHERE customer_id = ?
                   AND (property_address = ? OR instr(?, ',' || property_pin || ',') > 0)
                 ORDER BY uploaded_at DESC, id DESC
                 LIMIT 1`
        ).bind(appeal.customer_id, appeal.property_address || '', pinMatch).first();

        const governmentId = await db.prepare(
                `SELECT image_data, mime_type, uploaded_at
                 FROM government_id_images
                 WHERE customer_id = ?
                 ORDER BY uploaded_at DESC, id DESC
                 LIMIT 1`
        ).bind(appeal.customer_id).first();

        const documents = await db.prepare(
                `SELECT id, file_name, file_data, mime_type, uploaded_at
                 FROM appeal_supporting_documents
                 WHERE customer_id = ?
                   AND (property_address = ? OR instr(?, ',' || property_pin || ',') > 0)
                 ORDER BY uploaded_at DESC, id DESC
                 LIMIT 20`
        ).bind(appeal.customer_id, appeal.property_address || '', pinMatch).all();

        return {
                propertyImage: propertyImage || null,
                governmentId: governmentId || null,
                supportingDocuments: documents.results || [],
                missing: {
                        propertyImage: !propertyImage,
                        governmentId: !governmentId
                }
        };
}
