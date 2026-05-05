import { requireFirebaseUser, jsonResponse } from '../_auth.js';

export async function getAdminUser(context) {
        const { user, response } = await requireFirebaseUser(context.request);

        if (response) {
                return { response };
        }

        if (!context.env.DB) {
                return { response: jsonResponse({ error: 'Database not configured' }, 500) };
        }

        const { results } = await context.env.DB.prepare(
                "SELECT role FROM admins WHERE email = ?"
        ).bind(user.email || '').all();

        if (results.length === 0) {
                return { response: jsonResponse({ error: 'Unauthorized' }, 403) };
        }

        return {
                user,
                role: results[0].role
        };
}

export { jsonResponse };
