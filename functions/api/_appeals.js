import { sendPaymentNotification } from './_email.js';

export async function recordPaidAppeal(env, payment) {
        if (!env.DB) {
                return { dbStatus: 'not_configured', emailStatus: 'skipped' };
        }

        const existing = await env.DB.prepare(
                "SELECT transaction_id FROM appeals WHERE transaction_id = ?"
        ).bind(payment.transactionId).first();

        await insertAppeal(env, payment);

        if (payment.customerId && payment.propertyAddress) {
                try {
                        await env.DB.prepare(
                                `INSERT OR IGNORE INTO user_addresses (customer_id, address, email)
                                 VALUES (?, ?, ?)`
                        )
                                .bind(payment.customerId, payment.propertyAddress, payment.customerEmail || '')
                                .run();
                } catch (error) {
                        console.error('Could not add paid property to user_addresses:', error);
                }
        }

        let emailStatus = 'not_sent_existing_payment';
        if (!existing && payment.paymentStatus === 'paid') {
                try {
                        await sendPaymentNotification(env, payment);
                        emailStatus = 'sent';
                } catch (error) {
                        emailStatus = `error: ${error.message}`;
                        console.error('Payment notification failed:', error);
                }
        }

        return {
                dbStatus: 'recorded',
                emailStatus
        };
}

async function insertAppeal(env, payment) {
        try {
                await env.DB.prepare(
                        `INSERT INTO appeals (transaction_id, customer_id, customer_name, customer_email, property_address, payment_amount, payment_status, payment_date, appeal_status, appeal_date)
                         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'Pending', CURRENT_TIMESTAMP)
                         ON CONFLICT(transaction_id) DO UPDATE SET
                         customer_name = excluded.customer_name,
                         customer_email = excluded.customer_email,
                         payment_status = excluded.payment_status,
                         payment_date = excluded.payment_date`
                )
                        .bind(
                                payment.transactionId,
                                payment.customerId,
                                payment.customerName,
                                payment.customerEmail,
                                payment.propertyAddress,
                                payment.paymentAmount,
                                payment.paymentStatus
                        )
                        .run();
        } catch (error) {
                if (!error.message.includes('customer_name')) {
                        throw error;
                }

                await env.DB.prepare(
                        `INSERT INTO appeals (transaction_id, customer_id, customer_email, property_address, payment_amount, payment_status, payment_date, appeal_status, appeal_date)
                         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'Pending', CURRENT_TIMESTAMP)
                         ON CONFLICT(transaction_id) DO UPDATE SET
                         customer_email = excluded.customer_email,
                         payment_status = excluded.payment_status,
                         payment_date = excluded.payment_date`
                )
                        .bind(
                                payment.transactionId,
                                payment.customerId,
                                payment.customerEmail,
                                payment.propertyAddress,
                                payment.paymentAmount,
                                payment.paymentStatus
                        )
                        .run();
        }
}
