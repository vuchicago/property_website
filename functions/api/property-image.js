import { requireFirebaseUser, jsonResponse } from './_auth.js';

const MAX_DATA_URL_LENGTH = 350000;

function isValidDataUrl(value) {
        return /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value || '');
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
                const url = new URL(context.request.url);
                const pin = url.searchParams.get('pin') || '';

                if (!pin) {
                        return jsonResponse({ error: 'Missing property PIN' }, 400);
                }

                const image = await context.env.DB.prepare(
                        `SELECT image_data, mime_type, uploaded_at
                         FROM property_images
                         WHERE customer_id = ? AND property_pin = ?
                         ORDER BY uploaded_at DESC, id DESC
                         LIMIT 1`
                ).bind(user.uid, pin).first();

                return jsonResponse({ image: image || null });
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};

export const onRequestPost = async (context) => {
        const { user, response } = await requireFirebaseUser(context.request);

        if (response) {
                return response;
        }

        if (!context.env.DB) {
                return jsonResponse({ error: 'Database not configured' }, 500);
        }

        try {
                const { address, pin, imageData, mimeType } = await context.request.json();

                if (!address || !pin || !imageData) {
                        return jsonResponse({ error: 'Missing address, PIN, or image' }, 400);
                }

                if (imageData.length > MAX_DATA_URL_LENGTH || !isValidDataUrl(imageData)) {
                        return jsonResponse({ error: 'Image must be a resized JPEG, PNG, or WEBP under 400x400 pixels.' }, 400);
                }

                const savedAddress = await context.env.DB.prepare(
                        `SELECT user_addresses.id
                         FROM user_addresses
                         JOIN property_addresses
                           ON property_addresses.address = user_addresses.address
                         WHERE user_addresses.customer_id = ?
                           AND user_addresses.address = ?
                           AND property_addresses.pin = ?
                         LIMIT 1`
                ).bind(user.uid, address, pin).first();

                if (!savedAddress) {
                        return jsonResponse({ error: 'Add this property before uploading an image.' }, 400);
                }

                await context.env.DB.prepare(
                        `INSERT INTO property_images (customer_id, property_pin, property_address, image_data, mime_type)
                         VALUES (?, ?, ?, ?, ?)`
                ).bind(user.uid, pin, address, imageData, mimeType || 'image/jpeg').run();

                const image = await context.env.DB.prepare(
                        `SELECT image_data, mime_type, uploaded_at
                         FROM property_images
                         WHERE customer_id = ? AND property_pin = ?
                         ORDER BY uploaded_at DESC, id DESC
                         LIMIT 1`
                ).bind(user.uid, pin).first();

                return jsonResponse({ success: true, image });
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};
