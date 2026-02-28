// Helper to check if user is superadmin
async function checkSuperAdmin(email, env) {
        if (!email) return false;
        const { results } = await env.DB.prepare("SELECT role FROM admins WHERE email = ? AND role = 'superadmin'").bind(email).all();
        return results.length > 0;
}

export const onRequestGet = async (context) => {
        const url = new URL(context.request.url);
        const email = url.searchParams.get('email');

        if (!context.env.DB) {
                return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        try {
                // Any admin can view the list, but we'll restrict it to superadmin for safety based on requirements
                const isSuper = await checkSuperAdmin(email, context.env);

                // Also allow normal admins to just check their own role
                const checkOnly = url.searchParams.get('checkRoleOnly');

                if (checkOnly) {
                        const { results } = await context.env.DB.prepare("SELECT role FROM admins WHERE email = ?").bind(email).all();
                        if (results.length > 0) {
                                return new Response(JSON.stringify({ role: results[0].role }), { headers: { 'Content-Type': 'application/json' } });
                        } else {
                                return new Response(JSON.stringify({ error: 'Not an admin' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
                        }
                }

                if (!isSuper) {
                        return new Response(JSON.stringify({ error: 'Unauthorized. Superadmin only.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
                }

                const { results } = await context.env.DB.prepare("SELECT email, role FROM admins").all();

                return new Response(JSON.stringify(results), {
                        headers: { 'Content-Type': 'application/json' }
                });
        } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
};

export const onRequestPost = async (context) => {
        if (!context.env.DB) {
                return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        try {
                const { superEmail, newAdminEmail, role } = await context.request.json();

                const isSuper = await checkSuperAdmin(superEmail, context.env);
                if (!isSuper) {
                        return new Response(JSON.stringify({ error: 'Unauthorized. Superadmin only.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
                }

                if (!newAdminEmail) {
                        return new Response(JSON.stringify({ error: 'Missing new admin email' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }

                const finalRole = role === 'superadmin' ? 'superadmin' : 'admin';

                await context.env.DB.prepare(
                        "INSERT INTO admins (email, role) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET role = excluded.role"
                ).bind(newAdminEmail, finalRole).run();

                return new Response(JSON.stringify({ success: true }), {
                        headers: { 'Content-Type': 'application/json' }
                });

        } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
};

export const onRequestDelete = async (context) => {
        if (!context.env.DB) {
                return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        try {
                const { superEmail, removeEmail } = await context.request.json();

                const isSuper = await checkSuperAdmin(superEmail, context.env);
                if (!isSuper) {
                        return new Response(JSON.stringify({ error: 'Unauthorized. Superadmin only.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
                }

                if (removeEmail === 'vu@cookcountytaxcompare.com') {
                        return new Response(JSON.stringify({ error: 'Cannot remove the primary superadmin' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }

                await context.env.DB.prepare(
                        "DELETE FROM admins WHERE email = ?"
                ).bind(removeEmail).run();

                return new Response(JSON.stringify({ success: true }), {
                        headers: { 'Content-Type': 'application/json' }
                });

        } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
};
