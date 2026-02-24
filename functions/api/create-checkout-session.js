
export const onRequestPost = async (context) => {
        const STRIPE_KEY = context.env.STRIPE_SECRET_KEY || context.env.STRIPE_API_KEY;

        if (!STRIPE_KEY) {
                return new Response(JSON.stringify({ error: 'Stripe API key is missing' }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                });
        }

        try {
                const { priceId, propertyAddress, userId } = await context.request.json();

                if (!propertyAddress || !userId) {
                        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                                status: 400,
                                headers: { 'Content-Type': 'application/json' }
                        });
                }

                const PRICE_ID = priceId || context.env.STRIPE_PRICE_ID || 'price_1T0bF2RrARHriB9TIqHffgW0';
                const DOMAIN = context.env.YOUR_DOMAIN || new URL(context.request.url).origin;

                // Construct form-urlencoded body manually for nested params
                const body = new URLSearchParams();
                body.append('mode', 'payment');
                body.append('line_items[0][price]', PRICE_ID);
                body.append('line_items[0][quantity]', '1');
                body.append('success_url', `${DOMAIN}/return.html?session_id={CHECKOUT_SESSION_ID}`);
                body.append('cancel_url', `${DOMAIN}/index.html`);
                body.append('client_reference_id', userId);
                body.append('metadata[propertyAddress]', propertyAddress);

                const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
                        method: 'POST',
                        headers: {
                                'Authorization': `Bearer ${STRIPE_KEY}`,
                                'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: body.toString()
                });

                const session = await response.json();

                if (!response.ok) {
                        throw new Error(session.error?.message || 'Failed to create Stripe session');
                }

                return new Response(JSON.stringify({ url: session.url }), {
                        headers: { 'Content-Type': 'application/json' }
                });

        } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                });
        }
}
