import { getAdminUser, jsonResponse } from './_admin.js';

export const onRequestGet = async (context) => {
        const url = new URL(context.request.url);
        const { role, response } = await getAdminUser(context);

        if (response) {
                return response;
        }

        try {
                const checkOnly = url.searchParams.get('checkRoleOnly');

                if (checkOnly) {
                        return jsonResponse({ role });
                }

                if (role !== 'superadmin') {
                        return jsonResponse({ error: 'Unauthorized. Superadmin only.' }, 403);
                }

                const { results } = await context.env.DB.prepare("SELECT email, role FROM admins").all();

                return jsonResponse(results);
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};

export const onRequestPost = async (context) => {
        const { role: currentRole, response } = await getAdminUser(context);

        if (response) {
                return response;
        }

        if (currentRole !== 'superadmin') {
                return jsonResponse({ error: 'Unauthorized. Superadmin only.' }, 403);
        }

        try {
                const { newAdminEmail, role } = await context.request.json();

                if (!newAdminEmail) {
                        return jsonResponse({ error: 'Missing new admin email' }, 400);
                }

                const finalRole = role === 'superadmin' ? 'superadmin' : 'admin';

                await context.env.DB.prepare(
                        "INSERT INTO admins (email, role) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET role = excluded.role"
                ).bind(newAdminEmail, finalRole).run();

                return jsonResponse({ success: true });

        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};

export const onRequestDelete = async (context) => {
        const { role, response } = await getAdminUser(context);

        if (response) {
                return response;
        }

        if (role !== 'superadmin') {
                return jsonResponse({ error: 'Unauthorized. Superadmin only.' }, 403);
        }

        try {
                const { removeEmail } = await context.request.json();

                if (removeEmail === 'vu@cookcountytaxcompare.com') {
                        return jsonResponse({ error: 'Cannot remove the primary superadmin' }, 400);
                }

                await context.env.DB.prepare(
                        "DELETE FROM admins WHERE email = ?"
                ).bind(removeEmail).run();

                return jsonResponse({ success: true });

        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};
