import { markAppealPaymentStatus, recordPaidAppeal } from './_appeals.js';
import { getStripeConfig } from './_stripe.js';

export const onRequestPost = async (context) => {
        const stripe = getStripeConfig(context.env);
        const WEBHOOK_SECRET = stripe.webhookSecret;

        try {
                const body = await context.request.text();

                // --- Signature Verification (if webhook secret is configured) ---
                let event;
                if (WEBHOOK_SECRET) {
                        const signature = context.request.headers.get('stripe-signature');
                        if (!signature) {
                                return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
                                        status: 400,
                                        headers: { 'Content-Type': 'application/json' }
                                });
                        }

                        // Stripe signature verification without the SDK:
                        // Parse the signature header
                        const parts = signature.split(',').reduce((acc, part) => {
                                const [key, value] = part.split('=');
                                acc[key] = value;
                                return acc;
                        }, {});

                        const timestamp = parts['t'];
                        const expectedSig = parts['v1'];

                        // Build the signed payload
                        const signedPayload = `${timestamp}.${body}`;

                        // Compute HMAC SHA-256
                        const encoder = new TextEncoder();
                        const key = await crypto.subtle.importKey(
                                'raw',
                                encoder.encode(WEBHOOK_SECRET),
                                { name: 'HMAC', hash: 'SHA-256' },
                                false,
                                ['sign']
                        );
                        const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
                        const computedSig = Array.from(new Uint8Array(mac))
                                .map(b => b.toString(16).padStart(2, '0'))
                                .join('');

                        if (computedSig !== expectedSig) {
                                return new Response(JSON.stringify({ error: 'Invalid signature' }), {
                                        status: 400,
                                        headers: { 'Content-Type': 'application/json' }
                                });
                        }

                        event = JSON.parse(body);
                } else {
                        // No webhook secret configured — accept the event as-is (dev/testing mode)
                        event = JSON.parse(body);
                }

                if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
                        const session = event.data.object;

                        const transactionId = session.id;
                        const customerId = session.client_reference_id; // userId passed during checkout
                        const customerName = session.customer_details?.name || session.metadata?.userName || null;
                        const customerEmail = session.customer_details?.email || null;
                        const propertyAddress = session.metadata?.propertyAddress || null;
                        const propertyKey = session.metadata?.propertyKey || null;
                        const propertyPin = session.metadata?.propertyPin || null;
                        const paymentIntentId = typeof session.payment_intent === 'string'
                                ? session.payment_intent
                                : session.payment_intent?.id || null;
                        const paymentAmount = session.amount_total; // in cents
                        const paymentStatus = session.payment_status; // "paid", "unpaid", "no_payment_required"

                        // Write to D1 database
                        if (context.env.DB) {
                                await recordPaidAppeal(context.env, {
                                        transactionId,
                                        customerId,
                                        customerName,
                                        customerEmail,
                                        propertyAddress,
                                        propertyKey,
                                        propertyPin,
                                        paymentIntentId,
                                        paymentAmount,
                                        paymentStatus
                                });
                        } else {
                                console.error('D1 database (DB) binding not available — could not save appeal record.');
                        }
                } else if (event.type === 'checkout.session.async_payment_failed' || event.type === 'checkout.session.expired') {
                        const session = event.data.object;
                        if (context.env.DB) {
                                await markAppealPaymentStatus(context.env, {
                                        transactionId: session.id,
                                        paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
                                        paymentStatus: event.type === 'checkout.session.expired' ? 'expired' : 'failed'
                                });
                        }
                } else if (event.type === 'charge.refunded') {
                        const charge = event.data.object;
                        if (context.env.DB) {
                                await markAppealPaymentStatus(context.env, {
                                        paymentIntentId: typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id,
                                        paymentStatus: 'refunded'
                                });
                        }
                }

                return new Response(JSON.stringify({ received: true }), {
                        headers: { 'Content-Type': 'application/json' }
                });

        } catch (err) {
                console.error('Webhook error:', err);
                return new Response(JSON.stringify({ error: err.message }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                });
        }
}
