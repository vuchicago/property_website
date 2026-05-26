import { requireFirebaseUser, jsonResponse } from '../_auth.js';

export const PRIMARY_SUPERADMIN_EMAIL = 'vuchicago@gmail.com';
export const ADMIN_ROLES = new Set(['superadmin', 'admin']);
export const ACCOUNT_ROLES = new Set(['superadmin', 'admin', 'partner']);

export async function getAdminUser(context) {
        const { user, response } = await requireFirebaseUser(context.request);

        if (response) {
                return { response };
        }

        if (!context.env.DB) {
                return { response: jsonResponse({ error: 'Database not configured' }, 500) };
        }

        const email = normalizeEmail(user.email);
        await ensurePrimarySuperadmin(context.env.DB);

        const { results } = await context.env.DB.prepare(
                "SELECT role FROM admins WHERE email = ?"
        ).bind(email).all();

        if (results.length === 0) {
                return { response: jsonResponse({ error: 'Unauthorized' }, 403) };
        }

        return {
                user: {
                        ...user,
                        email
                },
                role: results[0].role
        };
}

export async function requireAdminAccount(context) {
        const account = await getAdminUser(context);
        if (account.response) return account;

        if (!ADMIN_ROLES.has(account.role)) {
                return { response: jsonResponse({ error: 'Unauthorized. Admin only.' }, 403) };
        }

        return account;
}

export async function ensurePrimarySuperadmin(db) {
        await db.prepare(
                "INSERT INTO admins (email, role) VALUES (?, 'superadmin') ON CONFLICT(email) DO UPDATE SET role = 'superadmin'"
        ).bind(PRIMARY_SUPERADMIN_EMAIL).run();
}

export function normalizeEmail(value) {
        return String(value || '').trim().toLowerCase();
}

export { jsonResponse };
