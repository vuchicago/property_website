import { sendNotificationEmail } from './_email.js';

const ADMIN_EMAIL = 'vu@cookcountytaxcompare.com';

export const onRequestPost = async (context) => {
        let savedMessageId = null;

        try {
                const { name, email, phone, propertyAddress, message, inquiryType, insuranceTypes, firmName } = await context.request.json();

                const inquiryKind = String(inquiryType || '').toLowerCase();
                const isInsuranceInquiry = inquiryKind === 'insurance';
                const isWaitlistInquiry = inquiryKind === 'property-tax-waitlist' || inquiryKind === 'waitlist';
                const isPartnershipInquiry = inquiryKind === 'partnership' || inquiryKind === 'partner';
                const normalizedType = isInsuranceInquiry
                        ? 'Insurance Inquiry'
                        : isWaitlistInquiry
                                ? 'Property Tax Appeal Waitlist'
                                : isPartnershipInquiry
                                        ? 'Attorney Partnership Inquiry'
                                        : 'Appeal Help Request';
                const selectedInsurance = Array.isArray(insuranceTypes) && insuranceTypes.length
                        ? insuranceTypes.join(', ')
                        : 'Not provided';

                if (!name || (!email && !isInsuranceInquiry)) {
                        return jsonResponse({ error: 'Name and email are required' }, 400);
                }

                if (email && !isValidEmail(email)) {
                        return jsonResponse({ error: 'Please enter a valid email address.' }, 400);
                }

                if (isInsuranceInquiry && !email && !phone) {
                        return jsonResponse({ error: 'Please provide an email address or phone number.' }, 400);
                }

                if (phone && !isValidPhone(phone)) {
                        return jsonResponse({ error: 'Please enter a valid 10-digit phone number.' }, 400);
                }

                if (isWaitlistInquiry && !phone) {
                        return jsonResponse({ error: 'Phone number is required for the waitlist.' }, 400);
                }

                if (isWaitlistInquiry && !propertyAddress) {
                        return jsonResponse({ error: 'Property address is required for the waitlist.' }, 400);
                }

                const submittedAt = new Date().toLocaleString('en-US', {
                        timeZone: 'America/Chicago',
                        dateStyle: 'medium',
                        timeStyle: 'short'
                });
                const savedMessage = firmName
                        ? `Firm Name: ${firmName}\n\n${message || ''}`.trim()
                        : message;

                savedMessageId = await saveContactMessage(context, {
                        inquiryType: normalizedType,
                        name,
                        email,
                        phone,
                        propertyAddress,
                        insuranceTypes: selectedInsurance,
                        message: savedMessage
                });

                const html = `
                        <h2>New ${escapeHtml(normalizedType)}</h2>
                        <table cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
                                <tr><td><strong>Inquiry Type</strong></td><td>${escapeHtml(normalizedType)}</td></tr>
                                <tr><td><strong>Name</strong></td><td>${escapeHtml(name)}</td></tr>
                                <tr><td><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>
                                <tr><td><strong>Phone</strong></td><td>${escapeHtml(phone || 'Not provided')}</td></tr>
                                <tr><td><strong>Firm Name</strong></td><td>${escapeHtml(firmName || 'Not provided')}</td></tr>
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
                        `Firm Name: ${firmName || 'Not provided'}`,
                        `Insurance Interest: ${selectedInsurance}`,
                        `Property Address: ${propertyAddress || 'Not provided'}`,
                        `Submitted: ${submittedAt}`,
                        '',
                        'Message:',
                        message || 'No message provided'
                ].join('\n');

                const to = isPartnershipInquiry
                        ? (context.env.PARTNERSHIP_NOTIFICATION_EMAIL || ADMIN_EMAIL)
                        : (context.env.ADMIN_NOTIFICATION_EMAIL || ADMIN_EMAIL);
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

function isValidEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

function isValidPhone(value) {
        const digits = String(value || '').replace(/\D/g, '');
        return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
}
