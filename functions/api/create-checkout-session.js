import { requireFirebaseUser, jsonResponse } from './_auth.js';
import { findBestPropertyAddress, getPropertyAddressCount } from './_property_addresses.js';

const PROPERTY_GROUP_KEY = `CASE
        WHEN pin_proration_rate IS NOT NULL AND pin_proration_rate < 1
        THEN normalized_address || '|fractional'
        ELSE normalized_address || '|pin:' || COALESCE(pin, id)
END`;

export const onRequestPost = async (context) => {
        const { user, response: authResponse } = await requireFirebaseUser(context.request);

        if (authResponse) {
                return authResponse;
        }

        if (!isEnabled(context.env.DEPLOYMENT_READY)) {
                return jsonResponse({ error: 'Appeal payments are not available yet. Please join the waitlist.' }, 403);
        }

        const STRIPE_KEY = context.env.STRIPE_SECRET_KEY || context.env.STRIPE_API_KEY;

        if (!STRIPE_KEY) {
                return jsonResponse({ error: 'Stripe API key is missing' }, 500);
        }

        try {
                const { propertyAddress, propertyKey, propertyPin } = await context.request.json();

                if (!propertyAddress) {
                        return jsonResponse({ error: 'Missing property address' }, 400);
                }

                if (!context.env.DB) {
                        return jsonResponse({ error: 'Database not configured' }, 500);
                }

                const validatedProperty = await findCheckoutProperty(context.env.DB, {
                        propertyAddress,
                        propertyKey,
                        propertyPin
                });

                if (!validatedProperty) {
                        const propertyAddressCount = await getPropertyAddressCount(context.env.DB);
                        if (propertyAddressCount === 0) {
                                return jsonResponse({
                                        error: 'The Cook County property address database has not been imported yet. Please import property_addresses before starting payments.'
                                }, 400);
                        }

                        return jsonResponse({
                                error: 'Please choose a valid Cook County property address before starting an appeal.'
                        }, 400);
                }

                const appealHelpAmountCents = parseAmountCents(context.env.APPEAL_HELP_AMOUNT_CENTS, 9900);
                if (!Number.isInteger(appealHelpAmountCents) || appealHelpAmountCents < 50) {
                        return jsonResponse({ error: 'Invalid appeal help amount configured' }, 500);
                }

                const DOMAIN = context.env.STRIPE_CHECKOUT_DOMAIN || new URL(context.request.url).origin;
                const checkoutPropertyAddress = String(propertyAddress || '').trim();
                const checkoutPropertyKey = validatedProperty.property_key || propertyKey || '';
                const checkoutPropertyPin = validatedProperty.pin || propertyPin || '';

                // Construct form-urlencoded body manually for nested params
                const body = new URLSearchParams();
                body.append('mode', 'payment');
                body.append('line_items[0][price_data][currency]', 'usd');
                body.append('line_items[0][price_data][unit_amount]', String(appealHelpAmountCents));
                body.append('line_items[0][price_data][product_data][name]', 'Cook County Property Tax Appeal Help');
                body.append('line_items[0][price_data][product_data][description]', checkoutPropertyAddress);
                body.append('line_items[0][quantity]', '1');
                body.append('success_url', `${DOMAIN}/return.html?session_id={CHECKOUT_SESSION_ID}`);
                body.append('cancel_url', `${DOMAIN}/index.html`);
                body.append('client_reference_id', user.uid);
                body.append('metadata[propertyAddress]', checkoutPropertyAddress);
                body.append('metadata[propertyKey]', checkoutPropertyKey);
                if (checkoutPropertyPin) {
                        body.append('metadata[propertyPin]', checkoutPropertyPin);
                }
                if (user.email) {
                        body.append('customer_email', user.email);
                        body.append('metadata[userEmail]', user.email);
                        body.append('payment_intent_data[receipt_email]', user.email);
                }
                body.append('payment_intent_data[metadata][propertyAddress]', checkoutPropertyAddress);
                body.append('payment_intent_data[metadata][propertyKey]', checkoutPropertyKey);
                body.append('payment_intent_data[metadata][propertyPin]', checkoutPropertyPin);
                body.append('payment_intent_data[metadata][userEmail]', user.email || '');

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

function isEnabled(value) {
        return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

async function findCheckoutProperty(db, { propertyAddress, propertyKey, propertyPin }) {
        if (propertyKey) {
                const row = await db.prepare(
                        `SELECT MIN(id) AS id,
                                group_concat(pin, ', ') AS pin,
                                address,
                                normalized_address,
                                ${PROPERTY_GROUP_KEY} AS property_key
                         FROM property_addresses
                         WHERE ${PROPERTY_GROUP_KEY} = ?
                         GROUP BY property_key
                         LIMIT 1`
                ).bind(propertyKey).first();
                if (row) return row;
        }

        if (propertyPin) {
                const firstPin = String(propertyPin).split(',')[0].trim();
                if (firstPin) {
                        const row = await db.prepare(
                                `SELECT MIN(id) AS id,
                                        group_concat(pin, ', ') AS pin,
                                        address,
                                        normalized_address,
                                        ${PROPERTY_GROUP_KEY} AS property_key
                                 FROM property_addresses
                                 WHERE pin = ?
                                 GROUP BY property_key
                                 LIMIT 1`
                        ).bind(firstPin).first();
                        if (row) return row;
                }
        }

        const exactAddress = await db.prepare(
                `SELECT MIN(id) AS id,
                        group_concat(pin, ', ') AS pin,
                        address,
                        normalized_address,
                        ${PROPERTY_GROUP_KEY} AS property_key
                 FROM property_addresses
                 WHERE address = ?
                 GROUP BY property_key
                 LIMIT 1`
        ).bind(propertyAddress).first();
        if (exactAddress) return exactAddress;

        return findBestPropertyAddress(db, propertyAddress);
}

function parseAmountCents(value, fallbackCents) {
        const raw = String(value ?? '').trim();
        if (!raw) return fallbackCents;

        const numeric = Number(raw);
        if (!Number.isFinite(numeric)) return fallbackCents;

        if (raw.includes('.')) {
                return Math.round(numeric * 100);
        }

        return Math.round(numeric);
}
