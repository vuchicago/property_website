import { requireAdminAccount, jsonResponse } from './_admin.js';

export const onRequestGet = async (context) => {
        const { user, response } = await requireAdminAccount(context);
        if (response) return response;

        try {
                const { results } = await context.env.DB.prepare(
                        `SELECT id, appeal_id, notification_type, title, message, is_read, created_at
                         FROM account_notifications
                         WHERE recipient_email = ?
                         ORDER BY created_at DESC
                         LIMIT 50`
                ).bind(user.email).all();

                return jsonResponse({ notifications: results || [] });
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};

export const onRequestPut = async (context) => {
        const { user, response } = await requireAdminAccount(context);
        if (response) return response;

        try {
                const { notificationId } = await context.request.json();

                if (notificationId) {
                        await context.env.DB.prepare(
                                "UPDATE account_notifications SET is_read = 1 WHERE id = ? AND recipient_email = ?"
                        ).bind(notificationId, user.email).run();
                } else {
                        await context.env.DB.prepare(
                                "UPDATE account_notifications SET is_read = 1 WHERE recipient_email = ?"
                        ).bind(user.email).run();
                }

                return jsonResponse({ success: true });
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};
