import { getAdminUser, jsonResponse } from './_admin.js';

export const onRequestGet = async (context) => {
        const url = new URL(context.request.url);
        const searchEmail = (url.searchParams.get('searchEmail') || '').trim();

        const { response } = await getAdminUser(context);
        if (response) {
                return response;
        }

        try {
                let query;
                let sql;
                let statement;

                if (searchEmail) {
                        query = `%${searchEmail.toLowerCase()}%`;
                        sql = `SELECT id, transaction_id, customer_name, customer_email, property_address, payment_amount, payment_status, payment_date, appeal_status, appeal_date, created_at
                               FROM appeals
                               WHERE lower(customer_email) LIKE ?
                               ORDER BY payment_date DESC, created_at DESC`;
                        statement = context.env.DB.prepare(sql).bind(query);
                } else {
                        sql = `SELECT id, transaction_id, customer_name, customer_email, property_address, payment_amount, payment_status, payment_date, appeal_status, appeal_date, created_at
                               FROM appeals
                               WHERE appeal_status = 'Pending'
                               ORDER BY payment_date ASC`;
                        statement = context.env.DB.prepare(sql);
                }

                let results;
                try {
                        ({ results } = await statement.all());
                } catch (error) {
                        if (!error.message.includes('customer_name')) {
                                throw error;
                        }

                        if (searchEmail) {
                                statement = context.env.DB.prepare(
                                        `SELECT id, transaction_id, NULL AS customer_name, customer_email, property_address, payment_amount, payment_status, payment_date, appeal_status, appeal_date, created_at
                                         FROM appeals
                                         WHERE lower(customer_email) LIKE ?
                                         ORDER BY payment_date DESC, created_at DESC`
                                ).bind(query);
                        } else {
                                statement = context.env.DB.prepare(
                                        `SELECT id, transaction_id, NULL AS customer_name, customer_email, property_address, payment_amount, payment_status, payment_date, appeal_status, appeal_date, created_at
                                         FROM appeals
                                         WHERE appeal_status = 'Pending'
                                         ORDER BY payment_date ASC`
                                );
                        }

                        ({ results } = await statement.all());
                }

                return jsonResponse(results);
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};

export const onRequestPut = async (context) => {
        const { response } = await getAdminUser(context);
        if (response) {
                return response;
        }

        try {
                const { transactionId, newStatus } = await context.request.json();

                if (!['Pending', 'Finished', 'Denied'].includes(newStatus)) {
                        return jsonResponse({ error: 'Invalid status' }, 400);
                }

                const result = await context.env.DB.prepare(
                        "UPDATE appeals SET appeal_status = ? WHERE transaction_id = ?"
                ).bind(newStatus, transactionId).run();

                if (result.meta.changes === 0) {
                        return jsonResponse({ error: 'Appeal not found' }, 404);
                }

                return jsonResponse({ success: true });

        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};
