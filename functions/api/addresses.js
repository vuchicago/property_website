import { requireFirebaseUser, jsonResponse } from './_auth.js';
import { findBestPropertyAddress } from './_property_addresses.js';

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
                        "SELECT * FROM user_addresses WHERE customer_id = ? ORDER BY created_at DESC"
                ).bind(user.uid).all();

                return jsonResponse(results);
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
}

export const onRequestPost = async (context) => {
        const { user, response } = await requireFirebaseUser(context.request);

        if (response) {
                return response;
        }

        if (!context.env.DB) {
                return jsonResponse({ error: 'Database not configured' }, 500);
        }

        try {
                const { address } = await context.request.json();

                if (!address) {
                        return jsonResponse({ error: 'Missing address' }, 400);
                }

                const propertyAddress = await findBestPropertyAddress(context.env.DB, address);

                if (!propertyAddress) {
                        return jsonResponse({
                                error: 'Please enter a valid Cook County property address from our database.'
                        }, 400);
                }

                // Insert new address. We use INSERT OR IGNORE to handle the UNIQUE constraint
                // quietly if the user tries to add the same address again.
                const result = await context.env.DB.prepare(
                        "INSERT OR IGNORE INTO user_addresses (customer_id, address, email) VALUES (?, ?, ?)"
                ).bind(user.uid, propertyAddress.address, user.email || '').run();

                // If changes === 0, it means it was a duplicate (ignored due to UNIQUE constraint)
                if (result.meta && result.meta.changes === 0) {
                        return jsonResponse({
                                success: true,
                                message: 'Address already exists',
                                address: propertyAddress.address,
                                property: propertyAddress
                        });
                }

                return jsonResponse({
                        success: true,
                        address: propertyAddress.address,
                        property: propertyAddress
                });
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
}
