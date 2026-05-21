import { requireFirebaseUser, jsonResponse } from './_auth.js';

const MAX_DATA_URL_LENGTH = 1200000;

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
                const image = await context.env.DB.prepare(
                        `SELECT image_data, mime_type, uploaded_at
                         FROM government_id_images
                         WHERE customer_id = ?
                         ORDER BY uploaded_at DESC, id DESC
                         LIMIT 1`
                ).bind(user.uid).first();

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
                const { imageData, mimeType } = await context.request.json();

                if (!imageData) {
                        return jsonResponse({ error: 'Missing government ID image' }, 400);
                }

                if (imageData.length > MAX_DATA_URL_LENGTH || !isValidDataUrl(imageData)) {
                        return jsonResponse({ error: 'Image must be a resized JPEG, PNG, or WEBP.' }, 400);
                }

                await context.env.DB.prepare(
                        `INSERT INTO government_id_images (customer_id, image_data, mime_type)
                         VALUES (?, ?, ?)`
                ).bind(user.uid, imageData, mimeType || 'image/jpeg').run();

                const image = await context.env.DB.prepare(
                        `SELECT image_data, mime_type, uploaded_at
                         FROM government_id_images
                         WHERE customer_id = ?
                         ORDER BY uploaded_at DESC, id DESC
                         LIMIT 1`
                ).bind(user.uid).first();

                return jsonResponse({ success: true, image });
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};
