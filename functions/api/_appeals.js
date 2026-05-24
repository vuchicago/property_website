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
                        if (payment.propertyKey) {
                                await env.DB.prepare(
                                        `INSERT OR IGNORE INTO user_addresses (customer_id, address, property_key, email)
                                         SELECT ?, address, ?, ?
                                         FROM property_addresses
                                         WHERE ${propertyGroupKeySql()} = ?
                                         LIMIT 1`
                                )
                                        .bind(payment.customerId, payment.propertyKey, payment.customerEmail || '', payment.propertyKey)
                                        .run();
                        } else {
                                await env.DB.prepare(
                                        `INSERT OR IGNORE INTO user_addresses (customer_id, address, property_key, email)
                                         SELECT ?, address, ${propertyGroupKeySql()}, ?
                                         FROM property_addresses
                                         WHERE address = ?
                                         LIMIT 1`
                                )
                                        .bind(payment.customerId, payment.customerEmail || '', payment.propertyAddress)
                                        .run();
                        }
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
                        `INSERT INTO appeals (transaction_id, customer_id, customer_name, customer_email, property_address, property_key, property_pin, payment_intent_id, payment_amount, payment_status, payment_date, appeal_status, appeal_date)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'Pending', NULL)
                         ON CONFLICT(transaction_id) DO UPDATE SET
                         customer_name = excluded.customer_name,
                         customer_email = excluded.customer_email,
                         property_key = excluded.property_key,
                         property_pin = excluded.property_pin,
                         payment_intent_id = excluded.payment_intent_id,
                         payment_status = excluded.payment_status,
                         payment_date = excluded.payment_date`
                )
                        .bind(
                                payment.transactionId,
                                payment.customerId,
                                payment.customerName,
                                payment.customerEmail,
                                payment.propertyAddress,
                                payment.propertyKey,
                                payment.propertyPin,
                                payment.paymentIntentId,
                                payment.paymentAmount,
                                payment.paymentStatus
                        )
                        .run();
        } catch (error) {
                if (!error.message.includes('customer_name') && !error.message.includes('property_key') && !error.message.includes('payment_intent_id')) {
                        throw error;
                }

                await env.DB.prepare(
                        `INSERT INTO appeals (transaction_id, customer_id, customer_email, property_address, payment_amount, payment_status, payment_date, appeal_status, appeal_date)
                         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'Pending', NULL)
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

export async function markAppealPaymentStatus(env, { transactionId, paymentIntentId, paymentStatus }) {
        if (!env.DB || !paymentStatus) {
                return { dbStatus: 'not_configured' };
        }

        if (transactionId) {
                const result = await env.DB.prepare(
                        `UPDATE appeals
                         SET payment_status = ?
                         WHERE transaction_id = ?`
                ).bind(paymentStatus, transactionId).run();
                if (result.meta?.changes) {
                        return { dbStatus: 'updated' };
                }
        }

        if (paymentIntentId) {
                try {
                        const result = await env.DB.prepare(
                                `UPDATE appeals
                                 SET payment_status = ?
                                 WHERE payment_intent_id = ?`
                        ).bind(paymentStatus, paymentIntentId).run();
                        if (result.meta?.changes) {
                                return { dbStatus: 'updated' };
                        }
                } catch (error) {
                        if (!String(error.message || '').includes('payment_intent_id')) {
                                throw error;
                        }
                }
        }

        return { dbStatus: 'not_found' };
}

function propertyGroupKeySql() {
        return `CASE
                WHEN pin_proration_rate IS NOT NULL AND pin_proration_rate < 1
                THEN normalized_address || '|fractional'
                ELSE normalized_address || '|pin:' || COALESCE(pin, id)
        END`;
}
