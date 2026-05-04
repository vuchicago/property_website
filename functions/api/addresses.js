import { requireFirebaseUser, jsonResponse } from './_auth.js';

export const onRequestGet = async (context) => {
        const { user, response } = await requireFirebaseUser(context.request);

        if (response) {
                return response;
        }

        if (!context.env.DB) {
                return jsonResponse({ error: 'Database not configured' }, 500);
        }

        try {
                const { results } = await context.env.DB.prepare(
                        "SELECT * FROM user_addresses WHERE customer_id = ? ORDER BY created_at DESC"
                ).bind(user.uid).all();

                return jsonResponse(results);
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
}

export const onRequestPost = async (context) => {
        const { user, response } = await requireFirebaseUser(context.request);

        if (response) {
                return response;
        }

        if (!context.env.DB) {
                return jsonResponse({ error: 'Database not configured' }, 500);
        }

        try {
                const { address } = await context.request.json();

                if (!address) {
                        return jsonResponse({ error: 'Missing address' }, 400);
                }

                // Insert new address. We use INSERT OR IGNORE to handle the UNIQUE constraint
                // quietly if the user tries to add the same address again.
                const result = await context.env.DB.prepare(
                        "INSERT OR IGNORE INTO user_addresses (customer_id, address, email) VALUES (?, ?, ?)"
                ).bind(user.uid, address, user.email || '').run();

                // If changes === 0, it means it was a duplicate (ignored due to UNIQUE constraint)
                if (result.meta && result.meta.changes === 0) {
                        return jsonResponse({ success: true, message: 'Address already exists' });
                }

                return jsonResponse({ success: true });
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
}
