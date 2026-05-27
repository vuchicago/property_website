import { sendPaymentNotification } from './_email.js';

export async function recordCheckoutAppeal(env, payment) {
        if (!env.DB) {
                return { dbStatus: 'not_configured' };
        }

        await insertAppeal(env, {
                ...payment,
                paymentStatus: payment.paymentStatus || 'unpaid'
        });

        return { dbStatus: 'checkout_recorded' };
}

export async function recordPaidAppeal(env, payment) {
        if (!env.DB) {
                return { dbStatus: 'not_configured', emailStatus: 'skipped' };
        }

        const existing = await env.DB.prepare(
                "SELECT transaction_id, payment_status FROM appeals WHERE transaction_id = ?"
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

        const becamePaid = payment.paymentStatus === 'paid'
                && (!existing || String(existing.payment_status || '').toLowerCase() !== 'paid');
        let emailStatus = becamePaid ? 'not_sent' : 'not_sent_existing_payment';
        if (becamePaid) {
                try {
                        await sendPaymentNotification(env, payment);
                        emailStatus = 'sent';
                } catch (error) {
                        emailStatus = `error: ${error.message}`;
                        console.error('Payment notification failed:', error);
                }

                await notifyAdminsOfPaidAppeal(env, payment);
        }

        return {
                dbStatus: 'recorded',
                emailStatus
        };
}

async function notifyAdminsOfPaidAppeal(env, payment) {
        try {
                const appeal = await env.DB.prepare(
                        "SELECT id FROM appeals WHERE transaction_id = ?"
                ).bind(payment.transactionId).first();

                const admins = await env.DB.prepare(
                        "SELECT email, role FROM admins WHERE role IN ('superadmin', 'admin')"
                ).all();

                for (const admin of admins.results || []) {
                        await env.DB.prepare(
                                `INSERT INTO account_notifications (recipient_email, recipient_role, appeal_id, notification_type, title, message)
                                 VALUES (?, ?, ?, 'appeal_paid', 'Property appeal paid', ?)`
                        ).bind(
                                admin.email,
                                admin.role,
                                appeal?.id || null,
                                `${payment.customerEmail || 'A customer'} paid for an appeal for ${payment.propertyAddress || 'a property'}.`
                        ).run();
                }
        } catch (error) {
                console.error('Could not create admin appeal notifications:', error);
        }
}

async function insertAppeal(env, payment) {
        const customerName = payment.customerName || [payment.customerFirstName, payment.customerLastName].filter(Boolean).join(' ') || null;
        try {
                await env.DB.prepare(
                        `INSERT INTO appeals (transaction_id, customer_id, customer_name, customer_first_name, customer_last_name, customer_phone, contract_name_confirmed_at, customer_email, property_address, property_key, property_pin, payment_intent_id, payment_amount, payment_status, payment_date, appeal_status, appeal_date)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'Pending', NULL)
                         ON CONFLICT(transaction_id) DO UPDATE SET
                         customer_name = excluded.customer_name,
                         customer_first_name = excluded.customer_first_name,
                         customer_last_name = excluded.customer_last_name,
                         customer_phone = excluded.customer_phone,
                         contract_name_confirmed_at = COALESCE(excluded.contract_name_confirmed_at, appeals.contract_name_confirmed_at),
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
                                customerName,
                                payment.customerFirstName || null,
                                payment.customerLastName || null,
                                payment.customerPhone || null,
                                payment.contractNameConfirmedAt || null,
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
                if (!isLegacyAppealsSchemaError(error)) {
                        throw error;
                }

                await insertAppealWithLegacySchema(env, payment);
        }
}

async function insertAppealWithLegacySchema(env, payment) {
        try {
                const customerName = payment.customerName || [payment.customerFirstName, payment.customerLastName].filter(Boolean).join(' ') || null;
                await env.DB.prepare(
                        `INSERT INTO appeals (transaction_id, customer_id, customer_name, customer_email, property_address, payment_amount, payment_status, payment_date, appeal_status, appeal_date)
                         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'Pending', NULL)
                         ON CONFLICT(transaction_id) DO UPDATE SET
                         customer_name = excluded.customer_name,
                         customer_email = excluded.customer_email,
                         payment_status = excluded.payment_status,
                         payment_date = excluded.payment_date`
                )
                        .bind(
                                payment.transactionId,
                                payment.customerId,
                                customerName,
                                payment.customerEmail,
                                payment.propertyAddress,
                                payment.paymentAmount,
                                payment.paymentStatus
                        )
                        .run();
        } catch (error) {
                if (!isLegacyAppealsSchemaError(error)) {
                        throw error;
                }

                await env.DB.prepare(
                        `INSERT INTO appeals (transaction_id, customer_id, customer_email, property_address, payment_amount, payment_status)
                         VALUES (?, ?, ?, ?, ?, ?)
                         ON CONFLICT(transaction_id) DO UPDATE SET
                         customer_email = excluded.customer_email,
                         payment_status = excluded.payment_status`
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

function isLegacyAppealsSchemaError(error) {
        const message = String(error?.message || '');
        return ['customer_name', 'customer_first_name', 'customer_last_name', 'customer_phone', 'contract_name_confirmed_at', 'property_key', 'payment_intent_id', 'payment_date', 'appeal_status', 'appeal_date']
                .some(column => message.includes(column));
}
