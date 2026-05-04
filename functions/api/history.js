import { requireFirebaseUser, jsonResponse } from './_auth.js';

export const onRequestGet = async (context) => {
        const { user, response } = await requireFirebaseUser(context.request);

        if (response) {
                return response;
        }

        if (!context.env.DB) {
                return jsonResponse({ error: 'Database not configured' }, 500);
        }

        try {
                const { results } = await context.env.DB.prepare(
                        "SELECT * FROM appeals WHERE customer_id = ? ORDER BY created_at DESC"
                ).bind(user.uid).all();

                // Transform to align with frontend expectations if possible, or frontend adapts.
                // History.js expects: propertyAddress, status, date (created_at)
                const mappedResults = results.map(row => ({
                        id: row.transaction_id,
                        propertyAddress: row.property_address,
                        status: row.payment_status === 'paid' ? (row.appeal_status || 'Pending') : 'Failed',
                        paymentStatus: row.payment_status,
                        paymentDate: row.payment_date,
                        appealStatus: row.appeal_status,
                        appealDate: row.appeal_date,
                        createdAt: row.created_at,
                        amount: row.payment_amount
                }));

                return jsonResponse(mappedResults);
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
}
