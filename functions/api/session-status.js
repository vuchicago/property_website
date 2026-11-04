import { recordPaidAppeal } from './_appeals.js';
import { getStripeConfig } from './_stripe.js';
import { requireFirebaseUser, jsonResponse } from './_auth.js';

export const onRequestGet = async (context) => {
        const { user, response: authResponse } = await requireFirebaseUser(context.request);
        if (authResponse) return authResponse;
        const stripe = getStripeConfig(context.env);
        const STRIPE_KEY = stripe.secretKey;
        const { searchParams } = new URL(context.request.url);
        const sessionId = searchParams.get('session_id');

        if (!sessionId) {
                return new Response(JSON.stringify({ error: 'Missing session_id' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                });
        }

        if (!STRIPE_KEY) {
                return new Response(JSON.stringify({ error: `Stripe ${stripe.mode} API key is missing` }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                });
        }

        try {
                const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
                        headers: {
                                'Authorization': `Bearer ${STRIPE_KEY}`
                        }
                });

                const session = await response.json();

                if (!response.ok) {
                        throw new Error(session.error?.message || 'Failed to retrieve session');
                }
                if (session.client_reference_id !== user.uid) {
                        return jsonResponse({ error: 'Checkout session not found.' }, 404);
                }

                let dbStatus = 'not_configured';
                let emailStatus = 'skipped';
                if (context.env.DB && session.payment_status === 'paid') {
                        try {
                                if (session.client_reference_id && session.metadata?.propertyAddress) {
                                        const result = await recordPaidAppeal(context.env, {
                                                transactionId: session.id,
                                                customerId: session.client_reference_id,
                                                customerName: session.metadata?.customerName || session.customer_details?.name || session.metadata?.userName || null,
                                                customerFirstName: session.metadata?.customerFirstName || null,
                                                customerLastName: session.metadata?.customerLastName || null,
                                                customerPhone: session.metadata?.customerPhone || null,
                                                contractNameConfirmedAt: session.metadata?.contractNameConfirmed === 'true'
                                                        ? stripeTimestampToIso(session.created)
                                                        : null,
                                                customerEmail: session.customer_details?.email || session.metadata?.userEmail || null,
                                                propertyAddress: session.metadata?.propertyAddress || null,
                                                propertyKey: session.metadata?.propertyKey || null,
                                                propertyPin: session.metadata?.propertyPin || null,
                                                paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null,
                                                paymentAmount: session.amount_total,
                                                paymentStatus: session.payment_status,
                                                paymentTest:session.metadata?.paymentTest==='true'
                                        });

                                        dbStatus = result.dbStatus;
                                        emailStatus = result.emailStatus;
                                } else {
                                        dbStatus = 'missing_customer_or_property';
                                }
                        } catch (dbError) {
                                dbStatus = `error: ${dbError.message}`;
                        }
                }

                return new Response(JSON.stringify({
                        status: session.status,
                        payment_status: session.payment_status,
                        customer_email: session.customer_details?.email,
                        metadata: session.metadata,
                        client_reference_id: session.client_reference_id,
                        amount_total: session.amount_total,
                        db_status: dbStatus,
                        email_status: emailStatus,
                        stripe_mode: stripe.mode
                }), {
                        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
                });

        } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                });
        }
}

function stripeTimestampToIso(timestamp) {
        const seconds = Number(timestamp);
        return Number.isFinite(seconds) && seconds > 0
                ? new Date(seconds * 1000).toISOString()
                : new Date().toISOString();
}
