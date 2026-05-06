import { requireFirebaseUser, jsonResponse } from './_auth.js';

function normalizeAddress(value) {
        return String(value || '')
                .toUpperCase()
                .replace(/[^A-Z0-9]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
}

async function findPropertyAddress(db, address) {
        const normalizedAddress = normalizeAddress(address);

        if (!normalizedAddress) {
                return null;
        }

        const exact = await db.prepare(
                `SELECT id, pin, address, city, zip, latitude, longitude
                 FROM property_addresses
                 WHERE normalized_address = ?
                 LIMIT 1`
        ).bind(normalizedAddress).first();

        if (exact) {
                return exact;
        }

        if (normalizedAddress.length < 8) {
                return null;
        }

        return db.prepare(
                `SELECT id, pin, address, city, zip, latitude, longitude
                 FROM property_addresses
                 WHERE normalized_address LIKE ?
                 ORDER BY LENGTH(normalized_address) ASC
                 LIMIT 1`
        ).bind(`${normalizedAddress}%`).first();
}

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

                const propertyAddress = await findPropertyAddress(context.env.DB, address);

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
