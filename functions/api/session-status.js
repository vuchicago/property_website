export const onRequestGet = async (context) => {
        const STRIPE_KEY = context.env.STRIPE_SECRET_KEY || context.env.STRIPE_API_KEY;
        const { searchParams } = new URL(context.request.url);
        const sessionId = searchParams.get('session_id');

        if (!sessionId) {
                return new Response(JSON.stringify({ error: 'Missing session_id' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                });
        }

        try {
                const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
                        headers: {
                                'Authorization': `Bearer ${STRIPE_KEY}`
                        }
                });

                const session = await response.json();

                if (!response.ok) {
                        throw new Error(session.error?.message || 'Failed to retrieve session');
                }

                return new Response(JSON.stringify({
                        status: session.status,
                        payment_status: session.payment_status,
                        customer_email: session.customer_details?.email,
                        metadata: session.metadata,
                        client_reference_id: session.client_reference_id
                }), {
                        headers: { 'Content-Type': 'application/json' }
                });

        } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                });
        }
}