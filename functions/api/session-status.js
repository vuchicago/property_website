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

                let dbStatus = 'not_configured';
                if (context.env.DB && (session.status === 'complete' || session.payment_status === 'paid')) {
                        try {
                                const transactionId = session.id;
                                const customerId = session.client_reference_id;
                                const customerEmail = session.customer_details?.email || session.metadata?.userEmail || null;
                                const propertyAddress = session.metadata?.propertyAddress || null;
                                const paymentAmount = session.amount_total;
                                const paymentStatus = session.payment_status;

                                if (customerId && propertyAddress) {
                                        await context.env.DB.prepare(
                                                `INSERT INTO appeals (transaction_id, customer_id, customer_email, property_address, payment_amount, payment_status, payment_date, appeal_status, appeal_date)
                                                 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'Pending', CURRENT_TIMESTAMP)
                                                 ON CONFLICT(transaction_id) DO UPDATE SET
                                                 payment_status = excluded.payment_status,
                                                 payment_date = excluded.payment_date`
                                        )
                                                .bind(transactionId, customerId, customerEmail, propertyAddress, paymentAmount, paymentStatus)
                                                .run();

                                        await context.env.DB.prepare(
                                                `INSERT OR IGNORE INTO user_addresses (customer_id, address, email)
                                                 VALUES (?, ?, ?)`
                                        )
                                                .bind(customerId, propertyAddress, customerEmail || '')
                                                .run();

                                        dbStatus = 'recorded';
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
                        db_status: dbStatus
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
