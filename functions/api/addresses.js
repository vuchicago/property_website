export const onRequestGet = async (context) => {
        const url = new URL(context.request.url);
        const userId = url.searchParams.get('userId');

        if (!userId) {
                return new Response(JSON.stringify({ error: 'Missing userId' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                });
        }

        if (!context.env.DB) {
                return new Response(JSON.stringify({ error: 'Database not configured' }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                });
        }

        try {
                const { results } = await context.env.DB.prepare(
                        "SELECT * FROM user_addresses WHERE customer_id = ? ORDER BY created_at DESC"
                ).bind(userId).all();

                return new Response(JSON.stringify(results), {
                        headers: { 'Content-Type': 'application/json' }
                });
        } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                });
        }
}

export const onRequestPost = async (context) => {
        if (!context.env.DB) {
                return new Response(JSON.stringify({ error: 'Database not configured' }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                });
        }

        try {
                const { userId, address } = await context.request.json();

                if (!userId || !address) {
                        return new Response(JSON.stringify({ error: 'Missing userId or address' }), {
                                status: 400,
                                headers: { 'Content-Type': 'application/json' }
                        });
                }

                // Insert new address. We use INSERT OR IGNORE to handle the UNIQUE constraint
                // quietly if the user tries to add the same address again.
                const result = await context.env.DB.prepare(
                        "INSERT OR IGNORE INTO user_addresses (customer_id, address) VALUES (?, ?)"
                ).bind(userId, address).run();

                // If changes === 0, it means it was a duplicate (ignored due to UNIQUE constraint)
                if (result.meta && result.meta.changes === 0) {
                        return new Response(JSON.stringify({ success: true, message: 'Address already exists' }), {
                                headers: { 'Content-Type': 'application/json' }
                        });
                }

                return new Response(JSON.stringify({ success: true }), {
                        headers: { 'Content-Type': 'application/json' }
                });
        } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                });
        }
}
