import { sendNotificationEmail } from './_email.js';

const ADMIN_EMAIL = 'vu@cookcountytaxcompare.com';

export const onRequestPost = async (context) => {
        let savedMessageId = null;

        try {
                const { name, email, phone, propertyAddress, message, inquiryType, insuranceTypes } = await context.request.json();

                const isInsuranceInquiry = String(inquiryType || '').toLowerCase() === 'insurance';
                const normalizedType = isInsuranceInquiry ? 'Insurance Inquiry' : 'Appeal Help Request';
                const selectedInsurance = Array.isArray(insuranceTypes) && insuranceTypes.length
                        ? insuranceTypes.join(', ')
                        : 'Not provided';

                if (!name || (!email && !isInsuranceInquiry)) {
                        return jsonResponse({ error: 'Name and email are required' }, 400);
                }

                if (isInsuranceInquiry && !email && !phone) {
                        return jsonResponse({ error: 'Please provide an email address or phone number.' }, 400);
                }

                const submittedAt = new Date().toLocaleString('en-US', {
                        timeZone: 'America/Chicago',
                        dateStyle: 'medium',
                        timeStyle: 'short'
                });

                savedMessageId = await saveContactMessage(context, {
                        inquiryType: normalizedType,
                        name,
                        email,
                        phone,
                        propertyAddress,
                        insuranceTypes: selectedInsurance,
                        message
                });

                const html = `
                        <h2>New ${escapeHtml(normalizedType)}</h2>
                        <table cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
                                <tr><td><strong>Inquiry Type</strong></td><td>${escapeHtml(normalizedType)}</td></tr>
                                <tr><td><strong>Name</strong></td><td>${escapeHtml(name)}</td></tr>
                                <tr><td><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>
                                <tr><td><strong>Phone</strong></td><td>${escapeHtml(phone || 'Not provided')}</td></tr>
                                <tr><td><strong>Insurance Interest</strong></td><td>${escapeHtml(selectedInsurance)}</td></tr>
                                <tr><td><strong>Property Address</strong></td><td>${escapeHtml(propertyAddress || 'Not provided')}</td></tr>
                                <tr><td><strong>Submitted</strong></td><td>${escapeHtml(submittedAt)}</td></tr>
                        </table>
                        <h3>Message</h3>
                        <p>${escapeHtml(message || 'No message provided').replace(/\n/g, '<br>')}</p>
                `;
                const text = [
                        `New ${normalizedType}`,
                        '',
                        `Inquiry Type: ${normalizedType}`,
                        `Name: ${name}`,
                        `Email: ${email}`,
                        `Phone: ${phone || 'Not provided'}`,
                        `Insurance Interest: ${selectedInsurance}`,
                        `Property Address: ${propertyAddress || 'Not provided'}`,
                        `Submitted: ${submittedAt}`,
                        '',
                        'Message:',
                        message || 'No message provided'
                ].join('\n');

                const to = context.env.ADMIN_NOTIFICATION_EMAIL || ADMIN_EMAIL;
                const from = context.env.NOTIFICATION_FROM_EMAIL
                        || (context.env.RESEND_API_KEY
                                ? 'Cook County Tax Compare <onboarding@resend.dev>'
                                : 'Cook County Tax Compare <notifications@inquiry.cookcountytaxcompare.com>');
                const result = await sendNotificationEmail(context.env, {
                        from,
                        to,
                        replyTo: email || undefined,
                        subject: `${normalizedType} from ${name}`,
                        html,
                        text
                });

                if (result?.skipped) {
                        await markContactEmailResult(context.env.DB, savedMessageId, false, result.reason || 'email_not_configured');
                        return jsonResponse({
                                success: true,
                                emailSent: false,
                                captured: true,
                                message: 'Message received. Email delivery is not configured, but the request was saved.'
                        });
                }

                await markContactEmailResult(context.env.DB, savedMessageId, true, null);
                return jsonResponse({ success: true, emailSent: true, captured: true });
        } catch (error) {
                console.error('Contact form failed:', error.message);

                if (savedMessageId) {
                        await markContactEmailResult(context.env.DB, savedMessageId, false, error.message);
                        return jsonResponse({
                                success: true,
                                emailSent: false,
                                captured: true,
                                message: 'Message received. Email delivery had an issue, but the request was saved.'
                        });
                }

                return jsonResponse({ error: error.message || 'Failed to send message' }, 500);
        }
};

async function saveContactMessage(context, values) {
        if (!context.env.DB) {
                return null;
        }

        const result = await context.env.DB.prepare(
                `INSERT INTO contact_messages (
                        inquiry_type,
                        name,
                        email,
                        phone,
                        property_address,
                        insurance_types,
                        message,
                        user_agent,
                        country,
                        cf_ray
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
                values.inquiryType,
                values.name,
                values.email || '',
                values.phone || '',
                values.propertyAddress || '',
                values.insuranceTypes || '',
                values.message || '',
                context.request.headers.get('user-agent') || '',
                context.request.cf?.country || '',
                context.request.headers.get('cf-ray') || ''
        ).run();

        return result.meta?.last_row_id || null;
}

async function markContactEmailResult(db, id, sent, error) {
        if (!db || !id) {
                return;
        }

        await db.prepare(
                `UPDATE contact_messages
                 SET email_sent = ?, email_error = ?
                 WHERE id = ?`
        ).bind(sent ? 1 : 0, error || null, id).run();
}

function jsonResponse(body, status = 200) {
        return new Response(JSON.stringify(body), {
                status,
                headers: { 'Content-Type': 'application/json' }
        });
}

function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, char => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
        })[char]);
}
