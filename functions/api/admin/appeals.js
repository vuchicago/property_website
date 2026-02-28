// Helper to check if user is admin
async function checkAdmin(email, env) {
        if (!email) return false;
        const { results } = await env.DB.prepare("SELECT role FROM admins WHERE email = ?").bind(email).all();
        return results.length > 0 ? results[0].role : null;
}

export const onRequestGet = async (context) => {
        const url = new URL(context.request.url);
        const email = url.searchParams.get('email');

        if (!context.env.DB) {
                return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        try {
                const role = await checkAdmin(email, context.env);
                if (!role) {
                        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
                }

                // Return all pending appeals
                const { results } = await context.env.DB.prepare(
                        "SELECT id, transaction_id, customer_email, property_address, payment_amount, payment_date, appeal_status, appeal_date FROM appeals WHERE appeal_status = 'Pending' ORDER BY payment_date ASC"
                ).all();

                return new Response(JSON.stringify(results), {
                        headers: { 'Content-Type': 'application/json' }
                });
        } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
};

export const onRequestPut = async (context) => {
        if (!context.env.DB) {
                return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        try {
                const { email, transactionId, newStatus } = await context.request.json();

                const role = await checkAdmin(email, context.env);
                if (!role) {
                        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
                }

                if (!['Pending', 'Success', 'Denied'].includes(newStatus)) {
                        return new Response(JSON.stringify({ error: 'Invalid status' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }

                const result = await context.env.DB.prepare(
                        "UPDATE appeals SET appeal_status = ? WHERE transaction_id = ?"
                ).bind(newStatus, transactionId).run();

                if (result.meta.changes === 0) {
                        return new Response(JSON.stringify({ error: 'Appeal not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
                }

                return new Response(JSON.stringify({ success: true }), {
                        headers: { 'Content-Type': 'application/json' }
                });

        } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
};
