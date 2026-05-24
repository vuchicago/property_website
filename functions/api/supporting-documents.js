import { requireFirebaseUser, jsonResponse } from './_auth.js';

const MAX_DATA_URL_LENGTH = 5600000;
const ALLOWED_MIME_TYPES = new Set([
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/webp'
]);

function isValidDocumentDataUrl(value) {
        const match = String(value || '').match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
        return Boolean(match && ALLOWED_MIME_TYPES.has(match[1]));
}

function cleanFileName(value) {
        return String(value || 'supporting-document')
                .replace(/[^\w .()\-]/g, '')
                .trim()
                .slice(0, 160) || 'supporting-document';
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

                const result = await context.env.DB.prepare(
                        `SELECT id, file_name, mime_type, uploaded_at
                         FROM appeal_supporting_documents
                         WHERE customer_id = ? AND property_pin = ?
                         ORDER BY uploaded_at DESC, id DESC
                         LIMIT 5`
                ).bind(user.uid, pin).all();

                return jsonResponse({ documents: result.results || [] });
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
                const { address, pin, fileName, fileData, mimeType } = await context.request.json();
                const normalizedMimeType = String(mimeType || '').toLowerCase();

                if (!address || !pin || !fileData) {
                        return jsonResponse({ error: 'Missing address, PIN, or document' }, 400);
                }

                if (!ALLOWED_MIME_TYPES.has(normalizedMimeType) || fileData.length > MAX_DATA_URL_LENGTH || !isValidDocumentDataUrl(fileData)) {
                        return jsonResponse({ error: 'Document must be a PDF, DOC, DOCX, JPG, PNG, or WEBP file under 4 MB.' }, 400);
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
                        return jsonResponse({ error: 'Add this property before uploading supporting documents.' }, 400);
                }

                await context.env.DB.prepare(
                        `INSERT INTO appeal_supporting_documents (customer_id, property_pin, property_address, file_name, file_data, mime_type)
                         VALUES (?, ?, ?, ?, ?, ?)`
                ).bind(user.uid, pin, address, cleanFileName(fileName), fileData, normalizedMimeType).run();

                const result = await context.env.DB.prepare(
                        `SELECT id, file_name, mime_type, uploaded_at
                         FROM appeal_supporting_documents
                         WHERE customer_id = ? AND property_pin = ?
                         ORDER BY uploaded_at DESC, id DESC
                         LIMIT 5`
                ).bind(user.uid, pin).all();

                return jsonResponse({ success: true, documents: result.results || [] });
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};
