export const onRequestPost = async (context) => {
        const STRIPE_KEY = context.env.STRIPE_SECRET_KEY || context.env.STRIPE_API_KEY;
        const WEBHOOK_SECRET = context.env.STRIPE_WEBHOOK_SECRET;

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

                // --- Handle the checkout.session.completed event ---
                if (event.type === 'checkout.session.completed') {
                        const session = event.data.object;

                        const transactionId = session.id;
                        const customerId = session.client_reference_id; // userId passed during checkout
                        const customerEmail = session.customer_details?.email || null;
                        const propertyAddress = session.metadata?.propertyAddress || null;
                        const paymentAmount = session.amount_total; // in cents
                        const paymentStatus = session.payment_status; // "paid", "unpaid", "no_payment_required"

                        // Write to D1 database
                        if (context.env.DB) {
                                await context.env.DB.prepare(
                                        `INSERT INTO appeals (transaction_id, customer_id, customer_email, property_address, payment_amount, payment_status, payment_date, appeal_status, appeal_date)
					 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'Pending', CURRENT_TIMESTAMP)
					 ON CONFLICT(transaction_id) DO UPDATE SET 
                        payment_status = excluded.payment_status,
                        payment_date = excluded.payment_date,
                        appeal_status = excluded.appeal_status,
                        appeal_date = excluded.appeal_date`
                                )
                                        .bind(transactionId, customerId, customerEmail, propertyAddress, paymentAmount, paymentStatus)
                                        .run();

                                if (paymentStatus === 'paid' && customerId && propertyAddress) {
                                        await context.env.DB.prepare(
                                                `INSERT OR IGNORE INTO user_addresses (customer_id, address, email)
                                                 VALUES (?, ?, ?)`
                                        )
                                                .bind(customerId, propertyAddress, customerEmail || '')
                                                .run();
                                }
                        } else {
                                console.error('D1 database (DB) binding not available — could not save appeal record.');
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
