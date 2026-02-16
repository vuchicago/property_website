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
                        "SELECT * FROM appeals WHERE customer_id = ? ORDER BY created_at DESC"
                ).bind(userId).all();

                // Transform to align with frontend expectations if possible, or frontend adapts.
                // History.js expects: propertyAddress, status, date (created_at)
                const mappedResults = results.map(row => ({
                        id: row.transaction_id,
                        propertyAddress: row.property_address,
                        status: row.payment_status === 'paid' ? 'pending' : 'failed', // pending appeal logic
                        createdAt: row.created_at,
                        amount: row.payment_amount
                }));

                return new Response(JSON.stringify(mappedResults), {
                        headers: { 'Content-Type': 'application/json' }
                });
        } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                });
        }
}
