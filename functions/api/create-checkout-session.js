import { requireFirebaseUser, jsonResponse } from './_auth.js';
import { findBestPropertyAddress } from './_property_addresses.js';

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
                const { propertyAddress } = await context.request.json();

                if (!propertyAddress) {
                        return jsonResponse({ error: 'Missing property address' }, 400);
                }

                if (!context.env.DB) {
                        return jsonResponse({ error: 'Database not configured' }, 500);
                }

                const validatedProperty = await findBestPropertyAddress(context.env.DB, propertyAddress);

                if (!validatedProperty) {
                        return jsonResponse({
                                error: 'Please choose a valid Cook County property address before starting an appeal.'
                        }, 400);
                }

                const appealHelpAmountCents = Number(context.env.APPEAL_HELP_AMOUNT_CENTS || 9900);
                if (!Number.isInteger(appealHelpAmountCents) || appealHelpAmountCents < 50) {
                        return jsonResponse({ error: 'Invalid appeal help amount configured' }, 500);
                }

                const DOMAIN = context.env.YOUR_DOMAIN || new URL(context.request.url).origin;

                // Construct form-urlencoded body manually for nested params
                const body = new URLSearchParams();
                body.append('mode', 'payment');
                body.append('line_items[0][price_data][currency]', 'usd');
                body.append('line_items[0][price_data][unit_amount]', String(appealHelpAmountCents));
                body.append('line_items[0][price_data][product_data][name]', 'Cook County Property Tax Appeal Help');
                body.append('line_items[0][price_data][product_data][description]', validatedProperty.address);
                body.append('line_items[0][quantity]', '1');
                body.append('success_url', `${DOMAIN}/return.html?session_id={CHECKOUT_SESSION_ID}`);
                body.append('cancel_url', `${DOMAIN}/index.html`);
                body.append('client_reference_id', user.uid);
                body.append('metadata[propertyAddress]', validatedProperty.address);
                if (validatedProperty.pin) {
                        body.append('metadata[propertyPin]', validatedProperty.pin);
                }
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
