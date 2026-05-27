import { requireFirebaseUser, jsonResponse } from './_auth.js';

export const onRequestGet = async (context) => {
        const { user, response } = await requireFirebaseUser(context.request);
        if (response) return response;

        if (!context.env.DB) {
                return jsonResponse({ error: 'Database not configured' }, 500);
        }

        try {
                const { results } = await context.env.DB.prepare(
                        `SELECT id, appeal_id, notification_type, title, message, is_read, created_at
                         FROM account_notifications
                         WHERE recipient_email = ?
                           AND recipient_role = 'user'
                         ORDER BY created_at DESC
                         LIMIT 50`
                ).bind(String(user.email || '').trim().toLowerCase()).all();

                return jsonResponse({ notifications: results || [] });
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};

export const onRequestPut = async (context) => {
        const { user, response } = await requireFirebaseUser(context.request);
        if (response) return response;

        if (!context.env.DB) {
                return jsonResponse({ error: 'Database not configured' }, 500);
        }

        try {
                const { notificationId } = await context.request.json();
                const email = String(user.email || '').trim().toLowerCase();

                if (notificationId) {
                        await context.env.DB.prepare(
                                `UPDATE account_notifications
                                 SET is_read = 1
                                 WHERE id = ?
                                   AND recipient_email = ?
                                   AND recipient_role = 'user'`
                        ).bind(notificationId, email).run();
                } else {
                        await context.env.DB.prepare(
                                `UPDATE account_notifications
                                 SET is_read = 1
                                 WHERE recipient_email = ?
                                   AND recipient_role = 'user'`
                        ).bind(email).run();
                }

                return jsonResponse({ success: true });
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};
