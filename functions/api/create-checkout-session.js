import { requireFirebaseUser, jsonResponse } from './_auth.js';

export const onRequestPost = async (context) => {
        const { user, response: authResponse } = await requireFirebaseUser(context.request);

        if (authResponse) {
                return authResponse;
        }

        const STRIPE_KEY = context.env.STRIPE_SECRET_KEY || context.env.STRIPE_API_KEY;

        if (!STRIPE_KEY) {
                return jsonResponse({ error: 'Stripe API key is missing' }, 500);
        }

        try {
                const { priceId, propertyAddress } = await context.request.json();

                if (!propertyAddress) {
                        return jsonResponse({ error: 'Missing property address' }, 400);
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
                body.append('client_reference_id', user.uid);
                body.append('metadata[propertyAddress]', propertyAddress);
                if (user.email) {
                        body.append('customer_email', user.email);
                        body.append('metadata[userEmail]', user.email);
                }

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

                return jsonResponse({ url: session.url });

        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
}
